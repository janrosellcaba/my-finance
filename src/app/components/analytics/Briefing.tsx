"use client";

import type { AnalyticsResult } from "@/lib/analytics";
import { InfoTip } from "./primitives";

/** The written read on the period, plus a transparent health score.
 *  Everything here is composed from computed figures — the score always shows its
 *  components so it can be argued with rather than taken on faith. */
export function Briefing({ data, privacyMode }: { data: AnalyticsResult; privacyMode: boolean }) {
    const { briefing, health } = data;

    const tone =
        health.score === null
            ? "text-muted"
            : health.score >= 75
              ? "text-brand"
              : health.score >= 55
                ? "text-ink"
                : health.score >= 35
                  ? "text-danger"
                  : "text-danger";

    const dot =
        health.score === null
            ? "bg-muted"
            : health.score >= 75
              ? "bg-brand"
              : health.score >= 55
                ? "bg-brand/60"
                : health.score >= 35
                  ? "bg-danger/60"
                  : "bg-danger";

    return (
        <div className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                    <p className={`text-sm font-bold uppercase tracking-wide ${tone}`}>{health.label}</p>
                </div>
                {health.score !== null && (
                    <div
                        className={`text-right transition-[filter,opacity] duration-250 ${
                            privacyMode ? "blur-[6px] select-none opacity-60" : ""
                        }`}
                    >
                        <p className="flex items-center justify-end gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                            Health
                            <InfoTip text="A single number combining savings rate, net-worth trend, spending stability, how much of your spend is committed to recurring charges, and your cash cushion — each scored against your own history, not an outside benchmark. Open 'How this score is built' below for the breakdown." />
                        </p>
                        <p className={`text-2xl font-extrabold leading-none ${tone}`}>
                            {health.score}
                            <span className="text-sm font-bold text-muted"> / 100</span>
                        </p>
                    </div>
                )}
            </div>

            <p className="mt-3 text-lg font-bold leading-snug text-ink">{briefing.headline}</p>

            {briefing.paragraphs.length > 0 && (
                <div className="mt-2 space-y-1.5">
                    {briefing.paragraphs.map((p, i) => (
                        <p key={i} className="text-sm leading-relaxed text-ink/80">
                            {p}
                        </p>
                    ))}
                </div>
            )}

            {briefing.caveats.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {briefing.caveats.map((c, i) => (
                        <p key={i} className="flex gap-2 text-xs text-muted">
                            <span aria-hidden="true">⚠</span>
                            <span>{c}</span>
                        </p>
                    ))}
                </div>
            )}

            {health.parts.length > 0 && (
                <details
                    className={`mt-4 border-t border-line pt-3 transition-[filter,opacity] duration-250 ${
                        privacyMode ? "blur-[5px] select-none opacity-60" : ""
                    }`}
                >
                    <summary className="text-xs font-bold uppercase tracking-wide text-muted select-none">
                        How this score is built
                    </summary>
                    <div className="mt-3 space-y-2">
                        {health.parts.map((p) => (
                            <div key={p.key} className="flex items-center gap-3 text-xs">
                                <span className="w-28 shrink-0 text-muted">{p.label}</span>
                                <div className="h-2 min-w-0 flex-1 rounded-full bg-chip">
                                    <div
                                        className={`h-full rounded-full ${p.score >= 55 ? "bg-brand" : "bg-danger"}`}
                                        style={{ width: `${p.score}%` }}
                                    />
                                </div>
                                <span className="w-8 shrink-0 text-right font-bold text-ink">{p.score}</span>
                                <span className="hidden w-52 shrink-0 truncate text-muted sm:block">{p.note}</span>
                            </div>
                        ))}
                        <p className="pt-1 text-xs text-muted">
                            Each part is scored against your own history, not an external benchmark, and weighted by how
                            much it tends to matter.
                        </p>
                    </div>
                </details>
            )}
        </div>
    );
}
