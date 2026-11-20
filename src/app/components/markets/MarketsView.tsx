"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { INK_BTN, formatDate } from "../../shared";
import { type TFunction } from "@/i18n";
import { useLanguage, useT } from "@/i18n/I18nProvider";
import {
    MARKET_TARGET_CURRENCIES,
    type MarketAssetDTO,
    type MarketCurrency,
    type MarketsPayload,
} from "@/lib/marketsTypes";
import { useUndoToast } from "../UndoToastProvider";
import { IconGrip, IconTrash, IconTrendingUp } from "../icons";
import { AddAssetModal } from "./AddAssetModal";
import { assetTypeLabel } from "./labels";
import { ChartStyleToggle } from "./ChartStyleToggle";
import { MarketChart, type ChartMode } from "./MarketChart";
import { UP_COLOR, DOWN_COLOR, formatMoney, type AppLanguage } from "./format";
import { convertAsset, periodView, type MarketPeriod } from "./marketsMath";

const PERIODS: MarketPeriod[] = ["1W", "1M", "3M", "1Y"];
const PERIOD_STORAGE_KEY = "markets-period";
const CURRENCY_STORAGE_KEY = "markets-currency";
const CHART_STORAGE_KEY = "markets-chart";
const CHART_MODES: readonly ChartMode[] = ["line", "candles"];

function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
    try {
        const value = window.localStorage.getItem(key);
        return allowed.includes(value as T) ? (value as T) : null;
    } catch {
        return null;
    }
}

function writeStored(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        /* storage unavailable — preference just won't persist */
    }
}

function initialCurrency(): MarketCurrency {
    return readStored(CURRENCY_STORAGE_KEY, MARKET_TARGET_CURRENCIES) ?? "EUR";
}

function periodLabel(t: TFunction, p: MarketPeriod): { label: string; title: string } {
    switch (p) {
        case "1W":
            return { label: t("markets.p1w"), title: t("markets.p1wTitle") };
        case "1M":
            return { label: t("markets.p1m"), title: t("markets.p1mTitle") };
        case "3M":
            return { label: t("markets.p3m"), title: t("markets.p3mTitle") };
        case "1Y":
            return { label: t("markets.p1y"), title: t("markets.p1yTitle") };
    }
}

function relativeTime(t: TFunction, since: number): string {
    const minutes = Math.floor((Date.now() - since) / 60000);
    if (minutes < 1) return t("markets.justNow");
    if (minutes < 60) return t("markets.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("markets.hoursAgo", { count: hours });
    return t("markets.daysAgo", { count: Math.floor(hours / 24) });
}

export function MarketsView() {
    const t = useT();
    const language = useLanguage();
    const router = useRouter();
    const { requestDelete } = useUndoToast();

    const [payload, setPayload] = useState<MarketsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    const [period, setPeriod] = useState<MarketPeriod>(() => readStored(PERIOD_STORAGE_KEY, PERIODS) ?? "3M");
    const [currency, setCurrency] = useState<MarketCurrency>(initialCurrency);
    const [chartMode, setChartMode] = useState<ChartMode>(() => readStored(CHART_STORAGE_KEY, CHART_MODES) ?? "line");
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    const refresh = useCallback(async (force: boolean) => {
        setRefreshing(true);
        try {
            const res = await fetch("/api/markets/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ force }),
            });
            if (res.ok) {
                const next = (await res.json()) as MarketsPayload;
                if (aliveRef.current) setPayload(next);
            }
        } catch {
            /* offline or provider down: keep showing what is cached */
        } finally {
            if (aliveRef.current) setRefreshing(false);
        }
    }, []);

    // Show what is cached right away, then refresh whatever has gone stale.
    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/markets");
            if (res.status === 401) {
                router.refresh();
                return;
            }
            const data = (await res.json()) as MarketsPayload & { success?: boolean };
            if (!aliveRef.current) return;
            if (!res.ok || !data.success) throw new Error("load failed");
            setPayload(data);
            setLoadFailed(false);
            setLoading(false);

            const needsData = data.assets.some((a) => a.history.length === 0);
            if (data.stale || needsData) await refresh(false);
        } catch {
            if (!aliveRef.current) return;
            setLoading(false);
            setRefreshing(false);
            setLoadFailed(true);
        }
    }, [router, refresh]);

    useEffect(() => {
        void load();
    }, [load]);

    function selectPeriod(next: MarketPeriod) {
        setPeriod(next);
        writeStored(PERIOD_STORAGE_KEY, next);
    }

    function selectChartMode(next: ChartMode) {
        setChartMode(next);
        writeStored(CHART_STORAGE_KEY, next);
    }

    function selectCurrency(next: MarketCurrency) {
        setCurrency(next);
        writeStored(CURRENCY_STORAGE_KEY, next);
    }

    function handleRemove(asset: MarketAssetDTO) {
        setPendingDeleteIds((prev) => new Set(prev).add(asset.id));
        requestDelete({
            message: t("markets.removed", { name: asset.name }),
            onUndo: () => {
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(asset.id);
                    return next;
                });
            },
            onCommit: async () => {
                try {
                    await fetch(`/api/markets/assets?id=${encodeURIComponent(asset.id)}`, { method: "DELETE" });
                } finally {
                    setPayload((prev) => (prev ? { ...prev, assets: prev.assets.filter((a) => a.id !== asset.id) } : prev));
                    setPendingDeleteIds((prev) => {
                        const next = new Set(prev);
                        next.delete(asset.id);
                        return next;
                    });
                }
            },
        });
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const visibleAssets = useMemo(
        () => (payload?.assets ?? []).filter((a) => !pendingDeleteIds.has(a.id)),
        [payload, pendingDeleteIds],
    );
    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const ids = visibleAssets.map((a) => a.id);
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from < 0 || to < 0) return;

        const nextIds = arrayMove(ids, from, to);
        setPayload((prev) => {
            if (!prev) return prev;
            const byId = new Map(prev.assets.map((a) => [a.id, a]));
            const reordered = nextIds.map((id) => byId.get(id)).filter((a): a is MarketAssetDTO => !!a);
            // Assets hidden while their undo toast is open keep their place at the end.
            return { ...prev, assets: [...reordered, ...prev.assets.filter((a) => !nextIds.includes(a.id))] };
        });
        void fetch("/api/markets/assets", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: nextIds }),
        })
            .then((res) => {
                if (!res.ok) void load();
            })
            .catch(() => void load());
    }

    const existingSymbols = useMemo(() => new Set((payload?.assets ?? []).map((a) => a.symbol)), [payload]);

    const lastUpdate = useMemo(() => {
        const times = visibleAssets.map((a) => a.fetchedAt).filter((v): v is number => v !== null);
        return times.length > 0 ? Math.min(...times) : null;
    }, [visibleAssets]);

    return (
        <div className="space-y-4 px-5 pt-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-ink">{t("markets.title")}</h1>
                <div className="flex items-center gap-2">
                    <ChartStyleToggle mode={chartMode} onChange={selectChartMode} />
                    <button type="button" onClick={() => setShowAdd(true)} className={`${INK_BTN} px-4 py-2 text-sm`}>
                        {t("markets.add")}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="grid flex-1 grid-cols-4 gap-1 rounded-xl bg-chip p-1">
                        {PERIODS.map((p) => {
                            const { label, title } = periodLabel(t, p);
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    title={title}
                                    onClick={() => selectPeriod(p)}
                                    onPointerUp={(e) => e.currentTarget.blur()}
                                    className={`rounded-lg py-2 text-xs font-semibold outline-none transition-colors duration-150 select-none focus:outline-none ${
                                        period === p ? "bg-paper text-ink" : "text-muted hover:text-ink"
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <div
                        role="group"
                        aria-label={t("markets.currencyAria")}
                        className="grid w-28 shrink-0 grid-cols-2 gap-1 rounded-xl bg-chip p-1"
                    >
                        {MARKET_TARGET_CURRENCIES.map((c) => (
                            <button
                                key={c}
                                type="button"
                                aria-pressed={currency === c}
                                onClick={() => selectCurrency(c)}
                                onPointerUp={(e) => e.currentTarget.blur()}
                                className={`rounded-lg py-2 text-xs font-semibold outline-none transition-colors duration-150 select-none focus:outline-none ${
                                    currency === c ? "bg-paper text-ink" : "text-muted hover:text-ink"
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="flex h-5 items-center gap-1.5 text-xs text-muted">
                    {refreshing ? (
                        <>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                            {t("markets.updating")}
                        </>
                    ) : lastUpdate !== null ? (
                        t("markets.updated", { time: relativeTime(t, lastUpdate) })
                    ) : null}
                    {visibleAssets.length > 0 && (
                        <button
                            type="button"
                            onClick={() => void refresh(true)}
                            disabled={refreshing}
                            title={t("markets.refreshAria")}
                            aria-label={t("markets.refreshAria")}
                            className="rounded-full p-1 text-muted outline-none transition-colors duration-150 hover:bg-chip hover:text-ink focus:outline-none disabled:opacity-50"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                            >
                                <path d="M20 12a8 8 0 1 1-2.5-5.8" />
                                <path d="M20 4v5h-5" />
                            </svg>
                        </button>
                    )}
                </p>
            </div>

            {loading ? (
                <div className="grid gap-3 lg:grid-cols-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-96 animate-pulse surface rounded-2xl" />
                    ))}
                </div>
            ) : loadFailed && !payload ? (
                <p className="pt-10 text-center text-muted">{t("markets.loadError")}</p>
            ) : visibleAssets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                        <IconTrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="font-bold text-ink">{t("markets.emptyTitle")}</p>
                        <p className="mt-0.5 text-xs text-muted">{t("markets.emptyHint")}</p>
                    </div>
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={visibleAssets.map((a) => a.id)} strategy={rectSortingStrategy}>
                        <div className="grid gap-3 lg:grid-cols-2">
                            {visibleAssets.map((asset) => (
                                <SortableAssetCard
                                    key={asset.id}
                                    asset={asset}
                                    fx={payload?.fx ?? {}}
                                    period={period}
                                    currency={currency}
                                    chartMode={chartMode}
                                    language={language}
                                    refreshing={refreshing}
                                    onRemove={() => handleRemove(asset)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <p className="pb-2 text-center text-[11px] text-muted">{t("markets.disclaimer")}</p>

            {showAdd && (
                <AddAssetModal
                    existingSymbols={existingSymbols}
                    onClose={() => setShowAdd(false)}
                    onAdded={() => {
                        setShowAdd(false);
                        void load();
                    }}
                />
            )}
        </div>
    );
}

type AssetCardProps = {
    asset: MarketAssetDTO;
    fx: MarketsPayload["fx"];
    period: MarketPeriod;
    currency: MarketCurrency;
    chartMode: ChartMode;
    language: AppLanguage;
    refreshing: boolean;
    onRemove: () => void;
    dragHandle?: ReactNode;
};

function SortableAssetCard(props: Omit<AssetCardProps, "dragHandle">) {
    const t = useT();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.asset.id });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
            className={`relative min-w-0 rounded-2xl ${isDragging ? "shadow-xl ring-1 ring-brand/30" : ""}`}
        >
            <AssetCard
                {...props}
                dragHandle={
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        aria-label={t("markets.reorderAria", { name: props.asset.name })}
                        className="-ml-1 mt-px shrink-0 cursor-grab touch-none rounded-full p-1 text-muted transition-colors duration-150 hover:text-ink active:cursor-grabbing"
                    >
                        <IconGrip className="h-4 w-4" />
                    </button>
                }
            />
        </div>
    );
}

function AssetCard({ asset, fx, period, currency, chartMode, language, refreshing, onRemove, dragHandle }: AssetCardProps) {
    const t = useT();
    const converted = useMemo(() => convertAsset(asset, currency, fx), [asset, currency, fx]);
    const view = useMemo(
        () => (converted ? periodView(converted.history, converted.price, period, converted.candles) : null),
        [converted, period],
    );

    const up = (view?.changePct ?? 0) >= 0;
    const color = up ? UP_COLOR : DOWN_COLOR;
    const lastDate = asset.history.length > 0 ? asset.history[asset.history.length - 1][0] : null;
    // Funds publish one price per day, so say which day it is from.
    const showClose = (asset.type === "fund" || asset.type === "etf" || asset.type === "stock") && lastDate;
    const waiting = !converted || (asset.history.length === 0 && refreshing);
    const lastPrice = converted?.price ?? (view && view.series.length > 0 ? view.series[view.series.length - 1][1] : null);

    return (
        <article className="surface rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-1.5">
                    {dragHandle}
                    <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{asset.name}</h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                        <span>{asset.symbol}</span>
                        <span aria-hidden>·</span>
                        <span>{assetTypeLabel(t, asset.type)}</span>
                        {!asset.ok && asset.history.length > 0 && (
                            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
                                {t("markets.stale")}
                            </span>
                        )}
                    </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t("markets.removeAria", { name: asset.name })}
                    className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-danger"
                >
                    <IconTrash className="h-4 w-4" />
                </button>
            </div>

            {waiting ? (
                <div className="mt-3 space-y-3" aria-hidden>
                    <div className="h-8 w-40 animate-pulse rounded-lg bg-chip" />
                    <div className="h-[260px] animate-pulse rounded-xl bg-chip" />
                </div>
            ) : (
                <>
                    <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                            <p className="text-2xl font-extrabold tabular-nums text-ink">
                                {converted!.price !== null ? formatMoney(converted!.price, converted!.currency, language) : "—"}
                            </p>
                            {(showClose || !converted!.converted) && (
                                <p className="mt-0.5 text-[11px] text-muted">
                                    {showClose ? t("markets.close", { date: formatDate(lastDate!) }) : ""}
                                    {showClose && !converted!.converted ? " · " : ""}
                                    {!converted!.converted ? t("markets.notConverted", { currency: converted!.currency }) : ""}
                                </p>
                            )}
                        </div>
                        {view?.changePct != null && (
                            <span
                                className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
                                style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
                            >
                                {up ? "▲" : "▼"} {up ? "+" : ""}
                                {view.changePct.toFixed(2)}%
                            </span>
                        )}
                    </div>

                    {view && view.series.length >= 2 ? (
                        <>
                            <div className="mt-3">
                                <MarketChart
                                    view={view}
                                    mode={chartMode}
                                    lastPrice={lastPrice}
                                    currency={converted!.currency}
                                    language={language}
                                    period={period}
                                />
                            </div>
                            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
                                <span>
                                    {t("markets.low")} {formatMoney(view.low!, converted!.currency, language)}
                                </span>
                                <span>
                                    {t("markets.high")} {formatMoney(view.high!, converted!.currency, language)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <p className="mt-4 rounded-xl bg-chip/60 py-8 text-center text-xs text-muted">
                            {t("markets.noHistory")}
                        </p>
                    )}
                </>
            )}
        </article>
    );
}
