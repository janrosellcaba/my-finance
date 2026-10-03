"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAnalyticsSnapshot, type AnalyticsResult, type PeriodMode } from "@/lib/analytics";
import { buildAnalyticsAiBrief } from "@/lib/analyticsAiBrief";
import { formatMonthYear, formatShortMonthYear } from "@/i18n";
import { useLanguage, useT } from "@/i18n/I18nProvider";
import { getFormatPrefs, type Account, type Category } from "../shared";
import { AnalyticsDashboard } from "./analytics/AnalyticsDashboard";
import { PeriodSelector } from "./analytics/PeriodSelector";
import { useUndoToast } from "./UndoToastProvider";
import { IconCopy } from "./icons";

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return;
    } catch {
        // Some browsers reject clipboard.writeText; fall back to a hidden textarea.
    }
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    if (!ok) throw new Error("copy failed");
}

function AnalyticsCopyMenu({
    onCopyJson,
    onCopyAi,
}: {
    onCopyJson: () => Promise<void>;
    onCopyAi: () => Promise<void>;
}) {
    const t = useT();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    function toggle() {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) {
            setPos({
                top: rect.bottom + 6,
                right: Math.max(12, window.innerWidth - rect.right),
            });
        }
        setOpen(true);
    }

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: PointerEvent) {
            if (wrapRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        function onScroll() {
            setOpen(false);
        }
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [open]);

    async function choose(action: () => Promise<void>) {
        setOpen(false);
        await action();
    }

    return (
        <div ref={wrapRef} className="relative">
            <button
                ref={btnRef}
                type="button"
                onClick={toggle}
                title={t("analytics.copyMenu")}
                aria-label={t("analytics.copyMenu")}
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex size-[1.375rem] items-center justify-center rounded-full bg-chip text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
            >
                <IconCopy className="h-3.5 w-3.5" />
            </button>
            {open && pos && (
                <div
                    role="menu"
                    style={{ top: pos.top, right: pos.right }}
                    className="toast-enter fixed z-30 min-w-[11.5rem] overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-md"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => void choose(onCopyJson)}
                        className="flex w-full px-3 py-2 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-chip"
                    >
                        {t("analytics.copyJson")}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => void choose(onCopyAi)}
                        className="flex w-full px-3 py-2 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-chip"
                    >
                        {t("analytics.copyAiPrompt")}
                    </button>
                </div>
            )}
        </div>
    );
}

export function AnalyticsView({
    privacyMode,
    accounts,
    categories,
}: {
    privacyMode: boolean;
    accounts: Account[];
    categories: Category[];
}) {
    const t = useT();
    const language = useLanguage();
    const router = useRouter();
    const { notify } = useUndoToast();
    const [mode, setMode] = useState<PeriodMode>("month");
    const [anchor, setAnchor] = useState<string | null>(null);
    const [accountId, setAccountId] = useState("all");
    const [data, setData] = useState<AnalyticsResult | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const params = new URLSearchParams({ mode });
        if (anchor) params.set("anchor", anchor);
        if (accountId !== "all") params.set("account", accountId);
        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (res.status === 401) {
            router.refresh();
            return;
        }
        const json = (await res.json()) as { success: boolean } & AnalyticsResult;
        if (json.success) setData(json);
    }, [mode, anchor, accountId, router]);

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, [fetchData]);

    useEffect(() => {
        if (accountId !== "all" && !accounts.some((a) => a.id === accountId)) {
            setAccountId("all");
        }
    }, [accounts, accountId]);

    function handlePeriodChange(nextMode: PeriodMode, nextAnchor: string | null) {
        setMode(nextMode);
        setAnchor(nextAnchor);
    }

    if (loading && !data) {
        return (
            <div className="animate-pulse space-y-6 px-5 pt-6 lg:px-8">
                <div className="h-7 w-28 rounded-full bg-chip" />
                <div className="h-11 w-full rounded-xl bg-chip" />
                <div className="surface overflow-hidden rounded-2xl">
                    <div className="grid grid-cols-2 lg:grid-cols-4">
                        <div className="col-span-2 space-y-2 border-b border-line p-4 lg:col-span-1 lg:border-b-0">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-6 w-20 rounded-full bg-chip" />
                        </div>
                        <div className="space-y-2 border-b border-line p-4 lg:border-b-0 lg:border-l">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-6 w-20 rounded-full bg-chip" />
                        </div>
                        <div className="space-y-2 border-b border-l border-line p-4 lg:border-b-0">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-6 w-20 rounded-full bg-chip" />
                        </div>
                        <div className="col-span-2 space-y-2 p-4 lg:col-span-1 lg:border-l lg:border-line">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-6 w-20 rounded-full bg-chip" />
                        </div>
                    </div>
                </div>
                <div className="h-48 w-full surface rounded-2xl p-4" />
            </div>
        );
    }
    if (!data) {
        return <p className="px-5 pt-10 text-center text-muted">{t("analytics.loadError")}</p>;
    }

    const analytics = data;
    const { period } = analytics;
    const focusName =
        accountId !== "all" ? (accounts.find((a) => a.id === accountId)?.name ?? null) : null;
    const monthOptions = analytics.monthOptions.map((m) => ({
        key: m.key,
        label: formatMonthYear(m.key, language),
    }));
    const periodLabel =
        mode === "all"
            ? t("analytics.allTime")
            : mode === "month"
              ? formatMonthYear((anchor ?? period.anchor) || period.start.slice(0, 7), language)
              : mode === "3m"
                ? `${formatShortMonthYear(period.start.slice(0, 7), language)} – ${formatShortMonthYear(period.end.slice(0, 7), language)}`
                : period.label;

    const snapshotOpts = {
        accountName: focusName,
        currency: getFormatPrefs().currency,
        periodLabel,
    };

    async function handleCopyJson() {
        try {
            await copyText(JSON.stringify(buildAnalyticsSnapshot(analytics, snapshotOpts), null, 2));
            notify(t("analytics.jsonCopied"));
        } catch {
            notify(t("analytics.copyFailed"));
        }
    }

    async function handleCopyAi() {
        try {
            await copyText(
                buildAnalyticsAiBrief(analytics, {
                    t,
                    language,
                    ...snapshotOpts,
                }),
            );
            notify(t("analytics.aiCopied"));
        } catch {
            notify(t("analytics.copyFailed"));
        }
    }

    return (
        <div className="space-y-6 px-5 pt-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-semibold text-ink">{t("analytics.title")}</h1>
                <div className="flex items-center gap-2">
                    {period.isPartial && (
                        <span className="rounded-full bg-chip px-3 py-1 text-xs font-semibold leading-none text-muted">
                            {t("analytics.dayOf", { elapsed: period.elapsedDays, total: period.totalDays })}
                        </span>
                    )}
                    <AnalyticsCopyMenu onCopyJson={handleCopyJson} onCopyAi={handleCopyAi} />
                </div>
            </div>

            <PeriodSelector
                mode={mode}
                anchor={anchor ?? period.anchor}
                label={periodLabel}
                monthOptions={monthOptions}
                yearOptions={analytics.availableYears}
                onChange={handlePeriodChange}
            />

            <AnalyticsDashboard
                data={analytics}
                privacyMode={privacyMode}
                accounts={accounts}
                categories={categories}
                selectedAccountId={accountId}
                focusName={focusName}
                onSelectAccount={setAccountId}
            />
        </div>
    );
}
