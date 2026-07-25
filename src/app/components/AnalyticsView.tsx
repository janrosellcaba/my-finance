"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsResult, PeriodMode } from "@/lib/analytics";
import { AdvancedDashboard } from "./analytics/AdvancedDashboard";
import { PeriodSelector } from "./analytics/PeriodSelector";
import { SimpleDashboard } from "./analytics/SimpleDashboard";

type View = "simple" | "advanced";
const VIEW_STORAGE_KEY = "analytics:view";

export function AnalyticsView({ privacyMode }: { privacyMode: boolean }) {
    const router = useRouter();
    const [mode, setMode] = useState<PeriodMode>("month");
    const [anchor, setAnchor] = useState<string | null>(null);
    const [data, setData] = useState<AnalyticsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>("simple");

    // Read after mount, not in a lazy initialiser — this component is server-rendered, and
    // touching localStorage during render would produce a hydration mismatch.
    useEffect(() => {
        if (localStorage.getItem(VIEW_STORAGE_KEY) === "advanced") setView("advanced");
    }, []);

    function changeView(next: View) {
        setView(next);
        localStorage.setItem(VIEW_STORAGE_KEY, next);
    }

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
        return <p className="px-5 pt-10 text-center text-muted">Loading your analytics…</p>;
    }
    if (!data) {
        return <p className="px-5 pt-10 text-center text-muted">Could not load your analytics.</p>;
    }

    const { period } = data;

    return (
        <div className="space-y-6 px-5 pt-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-extrabold text-ink">Analytics</h1>
                <div className="flex items-center gap-2">
                    {period.isPartial && (
                        <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-muted">
                            in progress · day {period.elapsedDays} of {period.totalDays}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => changeView(view === "simple" ? "advanced" : "simple")}
                        className="rounded-xl bg-chip px-4 py-2 text-xs font-bold text-ink transition-colors duration-150 hover:bg-chip-hover select-none"
                    >
                        {view === "simple" ? "Advanced ›" : "‹ Simple"}
                    </button>
                </div>
            </div>

            <PeriodSelector
                mode={mode}
                anchor={anchor ?? period.anchor}
                label={period.label}
                monthOptions={data.monthOptions}
                yearOptions={data.availableYears}
                onChange={handlePeriodChange}
            />

            {view === "simple" ? (
                <SimpleDashboard data={data} privacyMode={privacyMode} />
            ) : (
                <AdvancedDashboard data={data} privacyMode={privacyMode} />
            )}
        </div>
    );
}
