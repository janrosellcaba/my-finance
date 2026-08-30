"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconClose } from "./icons";

const TOUR_STORAGE_KEY = "myfinance-tour-seen";
const STORY_MS = 5500;

export type TourSlide = {
    id: string;
    eyebrow: string;
    title: string;
    body: string;
    visual: "welcome" | "home" | "add" | "list" | "analytics" | "todo" | "settings" | "privacy";
};

export const TOUR_SLIDES: TourSlide[] = [
    {
        id: "welcome",
        eyebrow: "Welcome",
        title: "Your money, clearly",
        body: "MyFinance tracks income, expenses, and transfers across your accounts — privately, on your own server.",
        visual: "welcome",
    },
    {
        id: "home",
        eyebrow: "Home",
        title: "Net worth at a glance",
        body: "The home screen shows total net worth, each account balance, and your most recent transactions.",
        visual: "home",
    },
    {
        id: "add",
        eyebrow: "Add",
        title: "Log anything in seconds",
        body: "Tap the green add button (or press T) to record income, an expense, or a transfer between accounts.",
        visual: "add",
    },
    {
        id: "list",
        eyebrow: "Transactions",
        title: "Search and filter",
        body: "Browse every movement, filter by type, account, category, or date, and edit or delete with a tap.",
        visual: "list",
    },
    {
        id: "analytics",
        eyebrow: "Analytics",
        title: "See where it goes",
        body: "Charts break down spending and income by category, month trends, transfers, and account balances.",
        visual: "analytics",
    },
    {
        id: "todo",
        eyebrow: "To-do",
        title: "Money tasks, remembered",
        body: "Keep small finance reminders here — pay a bill, move money, chase a refund — with optional due dates.",
        visual: "todo",
    },
    {
        id: "settings",
        eyebrow: "Settings",
        title: "Make it yours",
        body: "Set up accounts and categories, change colours and formats, export or back up your data, and more.",
        visual: "settings",
    },
    {
        id: "privacy",
        eyebrow: "Privacy",
        title: "Hide amounts anytime",
        body: "Tap the eye in the header to blur balances. Useful on a train, or when someone glances at your phone.",
        visual: "privacy",
    },
];

export function hasSeenTour(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return localStorage.getItem(TOUR_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

export function markTourSeen(): void {
    try {
        localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
        /* ignore */
    }
}

function TourVisual({ kind }: { kind: TourSlide["visual"] }) {
    if (kind === "welcome") {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-2xl font-extrabold text-white">
                    €
                </div>
                <div className="h-3 w-32 rounded-full bg-white/35" />
                <div className="h-2 w-24 rounded-full bg-white/20" />
            </div>
        );
    }
    if (kind === "home") {
        return (
            <div className="flex h-full flex-col justify-end gap-2 px-5 pb-6">
                <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                    <div className="h-2 w-16 rounded-full bg-white/35" />
                    <div className="mt-2 h-7 w-36 rounded-lg bg-white/55" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/12 p-3">
                        <div className="h-2 w-10 rounded-full bg-white/30" />
                        <div className="mt-2 h-4 w-16 rounded bg-white/45" />
                    </div>
                    <div className="rounded-xl bg-white/12 p-3">
                        <div className="h-2 w-10 rounded-full bg-white/30" />
                        <div className="mt-2 h-4 w-16 rounded bg-white/45" />
                    </div>
                </div>
            </div>
        );
    }
    if (kind === "add") {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
                <div className="w-full max-w-[200px] space-y-2 rounded-2xl bg-white/12 p-4">
                    <div className="h-8 rounded-lg bg-white/20" />
                    <div className="h-8 rounded-lg bg-white/20" />
                    <div className="h-10 rounded-xl bg-brand" />
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">
                    +
                </div>
            </div>
        );
    }
    if (kind === "list") {
        return (
            <div className="flex h-full flex-col justify-center gap-2 px-5">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-white/12 px-3 py-2.5">
                        <div className="h-8 w-8 rounded-lg bg-white/25" />
                        <div className="min-w-0 flex-1">
                            <div className="h-2.5 w-24 rounded-full bg-white/45" />
                            <div className="mt-1.5 h-2 w-16 rounded-full bg-white/25" />
                        </div>
                        <div className="h-3 w-12 rounded bg-white/40" />
                    </div>
                ))}
            </div>
        );
    }
    if (kind === "analytics") {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
                <div className="relative h-28 w-28">
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            background:
                                "conic-gradient(from 200deg, color-mix(in srgb, white 70%, transparent) 0 35%, color-mix(in srgb, white 45%, transparent) 35% 62%, color-mix(in srgb, white 25%, transparent) 62% 100%)",
                        }}
                    />
                    <div className="absolute inset-6 rounded-full bg-brand" />
                </div>
                <div className="flex w-full gap-1.5">
                    <div className="h-10 flex-1 rounded-md bg-white/40" />
                    <div className="h-7 flex-1 self-end rounded-md bg-white/25" />
                    <div className="h-14 flex-1 rounded-md bg-white/50" />
                    <div className="h-8 flex-1 self-end rounded-md bg-white/30" />
                </div>
            </div>
        );
    }
    if (kind === "todo") {
        return (
            <div className="flex h-full flex-col justify-center gap-2 px-5">
                {["Pay rent", "Move savings", "Check invoice"].map((label, i) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-white/12 px-3 py-3">
                        <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border-2 border-white/50 ${
                                i === 0 ? "bg-white/50" : ""
                            }`}
                        />
                        <span className="text-sm font-semibold text-white/90">{label}</span>
                    </div>
                ))}
            </div>
        );
    }
    if (kind === "settings") {
        return (
            <div className="flex h-full flex-col justify-center gap-2 px-5">
                {["Accounts", "Categories", "Appearance", "Backup"].map((label) => (
                    <div key={label} className="flex items-center justify-between rounded-xl bg-white/12 px-4 py-3">
                        <span className="text-sm font-semibold text-white/90">{label}</span>
                        <span className="text-white/40">›</span>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
            <div className="rounded-2xl bg-white/12 px-6 py-5 text-center">
                <div className="text-3xl font-extrabold tracking-widest text-white/80 blur-[3px]">€2.450,00</div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">Hidden</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="2.5" />
                    <path d="M4 4l16 16" />
                </svg>
            </div>
        </div>
    );
}

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [index, setIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<number | null>(null);
    const startedAt = useRef(0);

    const finish = useCallback(() => {
        markTourSeen();
        onClose();
    }, [onClose]);

    const goTo = useCallback(
        (next: number) => {
            if (next >= TOUR_SLIDES.length) {
                finish();
                return;
            }
            if (next < 0) return;
            setIndex(next);
            setProgress(0);
            startedAt.current = performance.now();
        },
        [finish]
    );

    useEffect(() => {
        if (!open) return;
        setIndex(0);
        setProgress(0);
        startedAt.current = performance.now();
    }, [open]);

    useEffect(() => {
        if (!open) return;

        function tick(now: number) {
            const elapsed = now - startedAt.current;
            const pct = Math.min(1, elapsed / STORY_MS);
            setProgress(pct);
            if (pct >= 1) {
                goTo(index + 1);
                return;
            }
            timerRef.current = requestAnimationFrame(tick);
        }

        timerRef.current = requestAnimationFrame(tick);
        return () => {
            if (timerRef.current != null) cancelAnimationFrame(timerRef.current);
        };
    }, [open, index, goTo]);

    if (!open) return null;

    const slide = TOUR_SLIDES[index];

    return (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/90 p-3 sm:items-center sm:p-6">
            <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-brand shadow-2xl sm:max-h-[min(720px,90dvh)] sm:h-[640px] h-full">
                <div className="absolute inset-0 opacity-40" aria-hidden>
                    <div className="absolute -left-10 top-24 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
                    <div className="absolute -right-8 bottom-32 h-48 w-48 rounded-full bg-black/20 blur-2xl" />
                </div>

                <div className="relative z-10 flex gap-1 px-3 pt-3">
                    {TOUR_SLIDES.map((s, i) => (
                        <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                            <div
                                className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
                                style={{
                                    width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div className="relative z-10 flex items-center justify-between px-4 py-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{slide.eyebrow}</p>
                        <p className="text-sm font-semibold text-white/90">
                            {index + 1} / {TOUR_SLIDES.length}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={finish}
                        aria-label="Close tour"
                        className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="relative z-10 min-h-0 flex-1 px-2">
                    <div className="mx-auto h-full max-w-sm overflow-hidden rounded-2xl bg-black/15">
                        <TourVisual kind={slide.visual} />
                    </div>
                    <button
                        type="button"
                        aria-label="Previous"
                        className="absolute inset-y-0 left-0 w-1/3"
                        onClick={() => goTo(index - 1)}
                    />
                    <button
                        type="button"
                        aria-label="Next"
                        className="absolute inset-y-0 right-0 w-1/3"
                        onClick={() => goTo(index + 1)}
                    />
                </div>

                <div className="relative z-10 space-y-2 px-5 pb-6 pt-4">
                    <h2 className="text-2xl font-extrabold tracking-tight text-white">{slide.title}</h2>
                    <p className="text-sm leading-relaxed text-white/85">{slide.body}</p>
                    <button
                        type="button"
                        onClick={() => goTo(index + 1)}
                        className="mt-3 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-brand select-none"
                    >
                        {index === TOUR_SLIDES.length - 1 ? "Done" : "Next"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function isAccountFirstDay(createdAt: string | null | undefined): boolean {
    if (!createdAt) return false;
    const created = Date.parse(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
    if (Number.isNaN(created)) return false;
    return Date.now() - created < 24 * 60 * 60 * 1000;
}
