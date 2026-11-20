"use client";

import type { ReactElement } from "react";
import { useT } from "@/i18n/I18nProvider";
import type { ChartMode } from "./MarketChart";

const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4",
};

const ICONS: Record<ChartMode, ReactElement> = {
    line: (
        <svg {...common}>
            <path d="m4 16 4.5-5 4 3L20 6" />
        </svg>
    ),
    area: (
        <svg {...common}>
            <path d="m4 15 4.5-4.5 4 3L20 7v11H4Z" fill="currentColor" fillOpacity={0.18} />
            <path d="m4 15 4.5-4.5 4 3L20 7" />
        </svg>
    ),
    candles: (
        <svg {...common}>
            <path d="M8 4v3M8 15v4M16 6v2M16 17v3" />
            <rect x="6" y="7" width="4" height="8" rx="0.8" />
            <rect x="14" y="8" width="4" height="9" rx="0.8" />
        </svg>
    ),
};

export function ChartStyleToggle({ mode, onChange }: { mode: ChartMode; onChange: (mode: ChartMode) => void }) {
    const t = useT();
    const items: { key: ChartMode; title: string }[] = [
        { key: "line", title: t("markets.styleLine") },
        { key: "area", title: t("markets.styleArea") },
        { key: "candles", title: t("markets.styleCandles") },
    ];

    return (
        <div role="group" aria-label={t("markets.styleAria")} className="flex gap-0.5 rounded-xl bg-chip p-1">
            {items.map(({ key, title }) => (
                <button
                    key={key}
                    type="button"
                    title={title}
                    aria-label={title}
                    aria-pressed={mode === key}
                    onClick={() => onChange(key)}
                    onPointerUp={(e) => e.currentTarget.blur()}
                    className={`rounded-lg p-2 outline-none transition-colors duration-150 select-none focus:outline-none ${
                        mode === key ? "bg-paper text-ink" : "text-muted hover:text-ink"
                    }`}
                >
                    {ICONS[key]}
                </button>
            ))}
        </div>
    );
}
