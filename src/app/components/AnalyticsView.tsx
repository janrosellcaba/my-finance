"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsResult, PeriodMode } from "@/lib/analytics";
import { AnalyticsDashboard } from "./analytics/AnalyticsDashboard";
import { PeriodSelector } from "./analytics/PeriodSelector";

export function AnalyticsView({ privacyMode }: { privacyMode: boolean }) {
    const router = useRouter();
    const [mode, setMode] = useState<PeriodMode>("month");
    const [anchor, setAnchor] = useState<string | null>(null);
    const [data, setData] = useState<AnalyticsResult | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const params = new URLSearchParams({ mode });
        if (anchor) params.set("anchor", anchor);
        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (res.status === 401) {
            router.refresh();
            return;
        }
        const json = (await res.json()) as { success: boolean } & AnalyticsResult;
        if (json.success) setData(json);
    }, [mode, anchor, router]);

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, [fetchData]);

    function handlePeriodChange(nextMode: PeriodMode, nextAnchor: string | null) {
        setMode(nextMode);
        setAnchor(nextAnchor);
    }

    if (loading && !data) {
        return (
            <div className="animate-pulse space-y-6 px-5 pt-6 lg:px-8">
                <div className="h-7 w-28 rounded-full bg-chip" />
                <div className="h-11 w-full rounded-xl bg-chip" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2 rounded-2xl border border-line bg-paper p-4 shadow-sm">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-6 w-20 rounded-full bg-chip" />
                        </div>
                    ))}
                </div>
                <div className="h-48 w-full rounded-2xl border border-line bg-paper p-4 shadow-sm" />
            </div>
        );
    }
    if (!data) {
        return <p className="px-5 pt-10 text-center text-muted">Could not load your analytics.</p>;
    }

    const { period } = data;

    return (
        <div className="space-y-6 px-5 pt-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-extrabold text-ink">Analytics</h1>
                {period.isPartial && (
                    <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-muted">
                        day {period.elapsedDays} of {period.totalDays}
                    </span>
                )}
            </div>

            <PeriodSelector
                mode={mode}
                anchor={anchor ?? period.anchor}
                label={period.label}
                monthOptions={data.monthOptions}
                yearOptions={data.availableYears}
                onChange={handlePeriodChange}
            />

            <AnalyticsDashboard data={data} privacyMode={privacyMode} />
        </div>
    );
}
