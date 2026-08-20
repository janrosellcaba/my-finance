"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { type Delta, type Insight } from "@/lib/analytics";
import { AMOUNT_MASK } from "../../shared";

const TOOLTIP_WIDTH = 256; // px, matches w-64 below
const TOOLTIP_MARGIN = 12; // px, minimum gap kept from the viewport edge

/** A small "what is this?" button that reveals an explanation on click/tap — works the
 *  same on mobile (no hover) as on desktop, and closes on outside click, Escape, or scroll.
 *  Positioned in the viewport (not the nearest scroll container) and clamped horizontally so
 *  it never gets clipped when the icon sits near the right edge of a narrow screen. */
export function InfoTip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);

    function toggle() {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) {
            const left = Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
            setPos({ top: rect.bottom + 6, left: Math.max(TOOLTIP_MARGIN, left) });
        }
        setOpen(true);
    }

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: PointerEvent) {
            if (btnRef.current?.contains(e.target as Node)) return;
            if (tipRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        // Fixed positioning is viewport-relative, so it won't track the button through a
        // scroll — closing on scroll avoids the tooltip visibly detaching from its icon.
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

    return (
        <span className="relative inline-flex shrink-0">
            <button
                ref={btnRef}
                type="button"
                onClick={toggle}
                aria-label="What is this?"
                aria-expanded={open}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-chip text-[10px] font-bold normal-case text-muted transition-colors duration-150 select-none hover:bg-chip-hover hover:text-ink"
            >
                i
            </button>
            {open && pos && (
                <div
                    ref={tipRef}
                    style={{ top: pos.top, left: pos.left }}
                    className="fixed z-30 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-paper p-3 text-xs font-normal normal-case leading-relaxed text-ink shadow-md"
                >
                    {text}
                </div>
            )}
        </span>
    );
}

export function Section({
    title,
    subtitle,
    children,
    action,
    info,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    action?: ReactNode;
    info?: string;
}) {
    return (
        <div>
            <div className="mb-3 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
                    {info && <InfoTip text={info} />}
                </span>
                {action}
            </div>
            {subtitle && <p className="mb-3 -mt-1 text-xs text-muted">{subtitle}</p>}
            {children}
        </div>
    );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-line bg-paper p-4 shadow-sm ${className}`}>{children}</div>
    );
}

/** A compact inline "+12.4% vs previous" pill. `goodWhenUp` flips the colour semantics. */
export function DeltaPill({
    delta,
    privacyMode,
    goodWhenUp = true,
    suffix = "",
}: {
    delta: Delta | null;
    privacyMode: boolean;
    goodWhenUp?: boolean;
    suffix?: string;
}) {
    if (!delta || delta.changePct === null) return null;
    const up = delta.change > 0;
    const flat = Math.abs(delta.changePct) < 0.5;
    const positive = goodWhenUp ? up : !up;
    const tone = flat ? "text-muted" : positive ? "text-brand" : "text-danger";
    return (
        <span
            className={`text-xs font-bold tabular-nums transition-[filter,opacity] duration-250 ${tone} ${
                privacyMode ? "blur-[5px] select-none opacity-70" : ""
            }`}
        >
            {flat ? "±" : up ? "▲" : "▼"}
            {Math.abs(delta.changePct).toFixed(1)}%
            {suffix ? ` ${suffix}` : ""}
        </span>
    );
}

export function StatTile({
    label,
    value,
    tone = "ink",
    delta,
    privacyMode,
    goodWhenUp = true,
    footnote,
    sparkline,
    big = false,
    info,
}: {
    label: string;
    value: string;
    tone?: "brand" | "danger" | "ink";
    delta?: Delta | null;
    privacyMode: boolean;
    goodWhenUp?: boolean;
    footnote?: string;
    sparkline?: number[];
    big?: boolean;
    info?: string;
}) {
    const toneClass = tone === "brand" ? "text-brand" : tone === "danger" ? "text-danger" : "text-ink";
    return (
        <div className="flex flex-col rounded-2xl border border-line bg-paper p-4 shadow-sm">
            <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                {info && <InfoTip text={info} />}
            </div>
            <p
                className={`mt-1 font-bold tabular-nums transition-[filter,opacity] duration-250 ${
                    big ? "text-3xl" : "text-xl"
                } ${toneClass} ${privacyMode ? "blur-[7px] select-none opacity-70" : ""}`}
            >
                {value}
            </p>
            <div className="mt-1 flex items-center gap-2">
                <DeltaPill delta={delta ?? null} privacyMode={privacyMode} goodWhenUp={goodWhenUp} />
                {footnote && <span className="truncate text-xs text-muted">{footnote}</span>}
            </div>
            {sparkline && sparkline.length > 1 && (
                <div className="mt-2">
                    <Sparkline values={sparkline} tone={tone} />
                </div>
            )}
        </div>
    );
}

/** Dependency-free inline sparkline — cheaper and sharper than a chart lib at this size. */
export function Sparkline({
    values,
    tone = "ink",
    width = 120,
    height = 24,
}: {
    values: number[];
    tone?: "brand" | "danger" | "ink";
    width?: number;
    height?: number;
}) {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stroke = tone === "brand" ? "var(--color-brand)" : tone === "danger" ? "var(--color-danger)" : "var(--color-muted)";
    const pts = values
        .map((v, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = height - ((v - min) / span) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

const SEVERITY_STYLE: Record<Insight["severity"], { border: string; badge: string; mark: string }> = {
    critical: { border: "border-danger/40", badge: "bg-danger text-white", mark: "!" },
    warn: { border: "border-danger/25", badge: "bg-danger-soft text-danger", mark: "!" },
    good: { border: "border-brand/30", badge: "bg-brand-soft text-brand", mark: "✓" },
    info: { border: "border-line", badge: "bg-chip text-muted", mark: "i" },
};

export function InsightCard({ insight }: { insight: Insight }) {
    const s = SEVERITY_STYLE[insight.severity];
    return (
        <div className={`flex gap-3 rounded-2xl border bg-paper p-4 shadow-sm ${s.border}`}>
            <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.badge}`}
                aria-hidden="true"
            >
                {s.mark}
            </span>
            <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{insight.title}</p>
                <p className="mt-0.5 text-xs text-muted">{insight.detail}</p>
                {insight.advice && (
                    <p className="mt-1.5 border-l-2 border-line pl-2 text-xs italic text-ink/70">{insight.advice}</p>
                )}
            </div>
        </div>
    );
}

/** Dashed placeholder rather than bare text, so an empty panel still reads as a
 *  deliberate cell in the desktop grid instead of a hole. */
export function EmptyNote({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-dashed border-line p-4">
            <p className="text-sm text-muted">{children}</p>
        </div>
    );
}
