"use client";

import { type PeriodMode } from "@/lib/analytics";

const MODES: { key: PeriodMode; label: string; title: string }[] = [
    { key: "month", label: "Month", title: "A single calendar month" },
    { key: "3m", label: "3 mo", title: "The last 3 months" },
    { key: "year", label: "Year", title: "A single calendar year" },
    { key: "all", label: "All", title: "Everything on record" },
];

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
        <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-chip/80 p-1 shadow-[inset_0_1px_2px_rgba(35,34,29,0.06)]">
                {MODES.map((m) => (
                    <button
                        key={m.key}
                        type="button"
                        title={m.title}
                        onClick={() => switchMode(m.key)}
                        className={`rounded-lg py-2 text-xs font-bold transition-all duration-150 select-none ${
                            mode === m.key
                                ? "surface text-ink"
                                : "text-muted hover:text-ink"
                        }`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {steppable ? (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => step(-1)}
                        disabled={!canPrev}
                        aria-label="Previous period"
                        className="shrink-0 rounded-xl bg-chip px-3 py-2.5 text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink disabled:opacity-30"
                    >
                        ‹
                    </button>
                    {/* A native select so mobile gets the system wheel picker — jumping back
                        several months is one gesture instead of many taps on the arrows. */}
                    <select
                        value={anchor ?? ""}
                        onChange={(e) => onChange(mode, e.target.value)}
                        className="field-recessed min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-base font-bold text-ink transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
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
                    <button
                        type="button"
                        onClick={() => step(1)}
                        disabled={!canNext}
                        aria-label="Next period"
                        className="shrink-0 rounded-xl bg-chip px-3 py-2.5 text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink disabled:opacity-30"
                    >
                        ›
                    </button>
                </div>
            ) : (
                <p className="surface rounded-xl px-4 py-2.5 text-center text-base font-bold text-ink">
                    {label}
                </p>
            )}
        </div>
    );
}
