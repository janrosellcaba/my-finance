"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAnalyticsSnapshot, type AnalyticsResult, type PeriodMode } from "@/lib/analytics";
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
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2 surface rounded-2xl p-4">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-6 w-20 rounded-full bg-chip" />
                        </div>
                    ))}
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

    async function handleCopyJson() {
        const snapshot = buildAnalyticsSnapshot(analytics, {
            accountName: focusName,
            currency: getFormatPrefs().currency,
            periodLabel,
        });
        try {
            await copyText(JSON.stringify(snapshot, null, 2));
            notify(t("analytics.jsonCopied"));
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
                        <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold leading-none text-muted">
                            {t("analytics.dayOf", { elapsed: period.elapsedDays, total: period.totalDays })}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleCopyJson}
                        title={t("analytics.copyJson")}
                        aria-label={t("analytics.copyJson")}
                        className="inline-flex size-[1.375rem] items-center justify-center rounded-full bg-chip text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
                    >
                        <IconCopy className="h-3.5 w-3.5" />
                    </button>
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
