"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsResult, PeriodMode } from "@/lib/analytics";
import { formatMonthYear, formatShortMonthYear } from "@/i18n";
import { useLanguage, useT } from "@/i18n/I18nProvider";
import { type Account, type Category } from "../shared";
import { AnalyticsDashboard } from "./analytics/AnalyticsDashboard";
import { PeriodSelector } from "./analytics/PeriodSelector";

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

    const { period } = data;
    const focusName =
        accountId !== "all" ? (accounts.find((a) => a.id === accountId)?.name ?? null) : null;
    const monthOptions = data.monthOptions.map((m) => ({
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

    return (
        <div className="space-y-6 px-5 pt-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-extrabold text-ink">{t("analytics.title")}</h1>
                {period.isPartial && (
                    <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-muted">
                        {t("analytics.dayOf", { elapsed: period.elapsedDays, total: period.totalDays })}
                    </span>
                )}
            </div>

            <PeriodSelector
                mode={mode}
                anchor={anchor ?? period.anchor}
                label={periodLabel}
                monthOptions={monthOptions}
                yearOptions={data.availableYears}
                onChange={handlePeriodChange}
            />

            <AnalyticsDashboard
                data={data}
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
