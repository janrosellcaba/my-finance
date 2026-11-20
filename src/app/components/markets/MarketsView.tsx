"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INK_BTN, formatDate } from "../../shared";
import { LANGUAGE_INTL, type TFunction } from "@/i18n";
import { useLanguage, useT } from "@/i18n/I18nProvider";
import {
    MARKET_TARGET_CURRENCIES,
    type MarketAssetDTO,
    type MarketCurrency,
    type MarketsPayload,
} from "@/lib/marketsTypes";
import { useUndoToast } from "../UndoToastProvider";
import { IconTrash, IconTrendingUp } from "../icons";
import { AddAssetModal } from "./AddAssetModal";
import { assetTypeLabel } from "./labels";
import { convertAsset, periodView, type MarketPeriod } from "./marketsMath";

const PERIODS: MarketPeriod[] = ["1W", "1M", "3M", "1Y"];
const PERIOD_STORAGE_KEY = "markets-period";
const CURRENCY_STORAGE_KEY = "markets-currency";

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
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
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
            if (!data.stale && !needsData) return;

            setRefreshing(true);
            try {
                const refreshed = await fetch("/api/markets/refresh", { method: "POST" });
                if (refreshed.ok) {
                    const next = (await refreshed.json()) as MarketsPayload;
                    if (aliveRef.current) setPayload(next);
                }
            } finally {
                if (aliveRef.current) setRefreshing(false);
            }
        } catch {
            if (!aliveRef.current) return;
            setLoading(false);
            setRefreshing(false);
            setLoadFailed(true);
        }
    }, [router]);

    useEffect(() => {
        void load();
    }, [load]);

    function selectPeriod(next: MarketPeriod) {
        setPeriod(next);
        writeStored(PERIOD_STORAGE_KEY, next);
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

    const visibleAssets = useMemo(
        () => (payload?.assets ?? []).filter((a) => !pendingDeleteIds.has(a.id)),
        [payload, pendingDeleteIds],
    );
    const existingSymbols = useMemo(() => new Set((payload?.assets ?? []).map((a) => a.symbol)), [payload]);

    const lastUpdate = useMemo(() => {
        const times = visibleAssets.map((a) => a.fetchedAt).filter((v): v is number => v !== null);
        return times.length > 0 ? Math.min(...times) : null;
    }, [visibleAssets]);

    return (
        <div className="space-y-4 px-5 pt-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-ink">{t("markets.title")}</h1>
                <button type="button" onClick={() => setShowAdd(true)} className={`${INK_BTN} px-4 py-2 text-sm`}>
                    {t("markets.add")}
                </button>
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
                <p className="flex h-4 items-center gap-1.5 text-xs text-muted">
                    {refreshing ? (
                        <>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                            {t("markets.updating")}
                        </>
                    ) : lastUpdate !== null ? (
                        t("markets.updated", { time: relativeTime(t, lastUpdate) })
                    ) : null}
                </p>
            </div>

            {loading ? (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-72 animate-pulse surface rounded-2xl" />
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
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {visibleAssets.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            fx={payload?.fx ?? {}}
                            period={period}
                            currency={currency}
                            language={language}
                            refreshing={refreshing}
                            onRemove={() => handleRemove(asset)}
                        />
                    ))}
                </div>
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

function formatMoney(value: number, currency: string, language: keyof typeof LANGUAGE_INTL): string {
    const abs = Math.abs(value);
    const digits = abs >= 1 ? 2 : 4;
    try {
        return new Intl.NumberFormat(LANGUAGE_INTL[language], {
            style: "currency",
            currency,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(value);
    } catch {
        return `${value.toFixed(digits)} ${currency}`;
    }
}

function formatAxisValue(value: number, language: keyof typeof LANGUAGE_INTL): string {
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
    return new Intl.NumberFormat(LANGUAGE_INTL[language], {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(value);
}

function formatAxisDate(iso: string, period: MarketPeriod, language: keyof typeof LANGUAGE_INTL): string {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const options: Intl.DateTimeFormatOptions =
        period === "1Y" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" };
    return d.toLocaleDateString(LANGUAGE_INTL[language], options);
}

function AssetCard({
    asset,
    fx,
    period,
    currency,
    language,
    refreshing,
    onRemove,
}: {
    asset: MarketAssetDTO;
    fx: MarketsPayload["fx"];
    period: MarketPeriod;
    currency: MarketCurrency;
    language: keyof typeof LANGUAGE_INTL;
    refreshing: boolean;
    onRemove: () => void;
}) {
    const t = useT();
    const converted = useMemo(() => convertAsset(asset, currency, fx), [asset, currency, fx]);
    const view = useMemo(
        () => (converted ? periodView(converted.history, converted.price, period) : null),
        [converted, period],
    );

    const up = (view?.changePct ?? 0) >= 0;
    const color = up ? "var(--color-brand)" : "var(--color-danger)";
    const gradientId = `mk-grad-${asset.id}`;
    const lastDate = asset.history.length > 0 ? asset.history[asset.history.length - 1][0] : null;
    // Funds publish one price per day, so say which day it is from.
    const showClose = (asset.type === "fund" || asset.type === "etf" || asset.type === "stock") && lastDate;
    const chartData = view?.series.map(([date, value]) => ({ date, value })) ?? [];
    const waiting = !converted || (asset.history.length === 0 && refreshing);

    return (
        <article className="surface rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
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
                    <div className="h-[110px] animate-pulse rounded-xl bg-chip" />
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
                                style={{
                                    color,
                                    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                                }}
                            >
                                {up ? "▲" : "▼"} {up ? "+" : ""}
                                {view.changePct.toFixed(2)}%
                            </span>
                        )}
                    </div>

                    {chartData.length >= 2 ? (
                        <>
                            <div className="mt-3 h-[190px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(v: string) => formatAxisDate(v, period, language)}
                                            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                                            tickLine={false}
                                            axisLine={{ stroke: "var(--color-line)" }}
                                            interval="preserveStartEnd"
                                            minTickGap={36}
                                            tickMargin={6}
                                        />
                                        <YAxis
                                            orientation="right"
                                            domain={["auto", "auto"]}
                                            tickCount={5}
                                            width={56}
                                            tickFormatter={(v: number) => formatAxisValue(v, language)}
                                            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            isAnimationActive={false}
                                            cursor={{ stroke: "var(--color-muted)", strokeDasharray: "3 3" }}
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null;
                                                const d = payload[0].payload as { date: string; value: number };
                                                return (
                                                    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-sm">
                                                        <p className="text-muted">{formatDate(d.date)}</p>
                                                        <p className="mt-0.5 font-semibold tabular-nums text-ink">
                                                            {formatMoney(d.value, converted!.currency, language)}
                                                        </p>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={color}
                                            strokeWidth={2}
                                            fill={`url(#${gradientId})`}
                                            dot={false}
                                            activeDot={{ r: 3.5, strokeWidth: 0, fill: color }}
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
                                <span>
                                    {t("markets.low")} {formatMoney(view!.low!, converted!.currency, language)}
                                </span>
                                <span>
                                    {t("markets.high")} {formatMoney(view!.high!, converted!.currency, language)}
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
