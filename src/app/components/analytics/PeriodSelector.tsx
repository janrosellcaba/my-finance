"use client";

import { type PeriodMode } from "@/lib/analytics";
import { useT } from "@/i18n/I18nProvider";

export function PeriodSelector({
    mode,
    anchor,
    label,
    monthOptions,
    yearOptions,
    onChange,
}: {
    mode: PeriodMode;
    anchor: string | null;
    label: string;
    monthOptions: { key: string; label: string }[];
    yearOptions: string[];
    onChange: (mode: PeriodMode, anchor: string | null) => void;
}) {
    const t = useT();
    const modes: { key: PeriodMode; label: string; title: string }[] = [
        { key: "month", label: t("analytics.periodMonth"), title: t("analytics.periodMonthTitle") },
        { key: "3m", label: t("analytics.period3m"), title: t("analytics.period3mTitle") },
        { key: "year", label: t("analytics.periodYear"), title: t("analytics.periodYearTitle") },
        { key: "all", label: t("analytics.periodAll"), title: t("analytics.periodAllTitle") },
    ];

    // Rolling windows are pinned to today, so only the two specific modes get a navigator.
    const steppable = mode === "month" || mode === "year";
    const options = mode === "month" ? monthOptions.map((m) => m.key) : yearOptions;
    // Options arrive newest-first; stepping should feel chronological.
    const ordered = [...options].reverse();
    const index = anchor ? ordered.indexOf(anchor) : -1;
    const canPrev = index > 0;
    const canNext = index >= 0 && index < ordered.length - 1;

    function step(dir: -1 | 1) {
        const next = ordered[index + dir];
        if (next) onChange(mode, next);
    }

    function switchMode(next: PeriodMode) {
        if (next === "month") onChange(next, monthOptions[0]?.key ?? null);
        else if (next === "year") onChange(next, yearOptions[0] ?? null);
        else onChange(next, null);
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-chip p-1">
                {modes.map((m) => (
                    <button
                        key={m.key}
                        type="button"
                        title={m.title}
                        onClick={() => switchMode(m.key)}
                        onPointerUp={(e) => e.currentTarget.blur()}
                        className={`rounded-lg py-2 text-xs font-semibold outline-none transition-colors duration-150 select-none focus:outline-none focus-visible:outline-none ${
                            mode === m.key ? "bg-paper text-ink" : "text-muted hover:text-ink"
                        }`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={!steppable || !canPrev}
                    aria-label={t("analytics.prevPeriod")}
                    onPointerUp={(e) => e.currentTarget.blur()}
                    className="shrink-0 rounded-xl bg-chip px-3 py-2.5 text-muted outline-none transition-colors duration-150 hover:bg-chip-hover hover:text-ink focus:outline-none disabled:opacity-30"
                >
                    ‹
                </button>
                {/* A native select so mobile gets the system wheel picker — jumping back
                    several months is one gesture instead of many taps on the arrows. */}
                {steppable ? (
                    <select
                        value={anchor ?? ""}
                        onChange={(e) => onChange(mode, e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-base font-semibold text-ink outline-none focus:border-line focus:outline-none"
                    >
                        {mode === "month"
                            ? monthOptions.map((m) => (
                                  <option key={m.key} value={m.key}>
                                      {m.label}
                                  </option>
                              ))
                            : yearOptions.map((y) => (
                                  <option key={y} value={y}>
                                      {y}
                                  </option>
                              ))}
                    </select>
                ) : (
                    <p className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-base font-semibold text-ink">
                        {label}
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={!steppable || !canNext}
                    aria-label={t("analytics.nextPeriod")}
                    onPointerUp={(e) => e.currentTarget.blur()}
                    className="shrink-0 rounded-xl bg-chip px-3 py-2.5 text-muted outline-none transition-colors duration-150 hover:bg-chip-hover hover:text-ink focus:outline-none disabled:opacity-30"
                >
                    ›
                </button>
            </div>
        </div>
    );
}
