"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
    IconBank,
    IconChart,
    IconCheckSquare,
    IconClose,
    IconEye,
    IconGrip,
    IconHome,
    IconList,
    IconPencil,
    IconRadioDot,
    IconSettings,
    IconUtensils,
    IconWallet,
} from "./icons";

const TOUR_STORAGE_KEY = "myfinance-tour-seen";
const SETUP_STORAGE_KEY = "myfinance-setup-guide";
const STORY_MS = 8000;

export type SetupGuideStep = "accounts" | "categories";

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

export function getSetupGuideStep(): SetupGuideStep | null {
    if (typeof window === "undefined") return null;
    try {
        const v = localStorage.getItem(SETUP_STORAGE_KEY);
        if (v === "accounts" || v === "categories") return v;
        return null;
    } catch {
        return null;
    }
}

export function setSetupGuideStep(step: SetupGuideStep | "done" | null): void {
    try {
        if (!step || step === "done") {
            localStorage.setItem(SETUP_STORAGE_KEY, "done");
        } else {
            localStorage.setItem(SETUP_STORAGE_KEY, step);
        }
    } catch {
        /* ignore */
    }
}

export function isSetupGuideDone(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return localStorage.getItem(SETUP_STORAGE_KEY) === "done";
    } catch {
        return false;
    }
}

type VisualKind =
    | "welcome"
    | "accounts"
    | "categories"
    | "home"
    | "add"
    | "transactions"
    | "analytics"
    | "privacy";

export type TourSlide = {
    id: string;
    step?: string;
    title: string;
    body: string;
    visual: VisualKind;
    nav?: "home" | "transactions" | "todo" | "analytics" | "config";
};

export const TOUR_SLIDES: TourSlide[] = [
    {
        id: "welcome",
        title: "Welcome to MyFinance",
        body: "A private place to track income, expenses, and transfers. Two setup steps first — then you’re ready to log money.",
        visual: "welcome",
        nav: "home",
    },
    {
        id: "accounts",
        step: "Step 1 of 2",
        title: "Add your bank accounts",
        body: "Open Settings → Bank accounts. Add each wallet or bank you use. Set the initial balance to what it already holds, and tap the radio to pick a default account for new transactions.",
        visual: "accounts",
        nav: "config",
    },
    {
        id: "categories",
        step: "Step 2 of 2",
        title: "Set up categories",
        body: "Settings → Categories. Create income and expense labels (Food, Salary, Rent…). Pick a colour and icon, drag to reorder, and set a default for each type.",
        visual: "categories",
        nav: "config",
    },
    {
        id: "home",
        title: "Your home screen",
        body: "Net worth at the top, account cards underneath, recent transactions below. The green button starts a new income, expense, or transfer.",
        visual: "home",
        nav: "home",
    },
    {
        id: "add",
        title: "Add a transaction",
        body: "Choose type, amount, account, and category. Transfers move money between two of your accounts. Shortcut: press T anywhere.",
        visual: "add",
        nav: "home",
    },
    {
        id: "transactions",
        title: "Transactions tab",
        body: "Full history with filters for type, account, category, and dates. Tap any row to edit or delete it.",
        visual: "transactions",
        nav: "transactions",
    },
    {
        id: "analytics",
        title: "Analytics",
        body: "Spending and income by category, month trends, transfers, and account balances — so you see where money goes.",
        visual: "analytics",
        nav: "analytics",
    },
    {
        id: "privacy",
        title: "Hide amounts anytime",
        body: "Tap the eye in the header to blur balances. Find this tour again anytime under Settings → App tour.",
        visual: "privacy",
        nav: "home",
    },
];

export function isAccountFirstDay(createdAt: string | null | undefined): boolean {
    if (!createdAt) return false;
    const created = Date.parse(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
    if (Number.isNaN(created)) return false;
    return Date.now() - created < 24 * 60 * 60 * 1000;
}

function MiniNav({ active }: { active: NonNullable<TourSlide["nav"]> }) {
    const items = [
        { key: "home" as const, label: "Home", Icon: IconHome },
        { key: "transactions" as const, label: "Txns", Icon: IconList },
        { key: "todo" as const, label: "To-Do", Icon: IconCheckSquare },
        { key: "analytics" as const, label: "Stats", Icon: IconChart },
        { key: "config" as const, label: "Settings", Icon: IconSettings },
    ];
    return (
        <div className="flex border-t border-line bg-paper px-0.5 pb-1 pt-1">
            {items.map(({ key, label, Icon }) => {
                const on = key === active;
                return (
                    <div
                        key={key}
                        className={`flex flex-1 flex-col items-center gap-0.5 py-1 ${on ? "text-brand" : "text-muted"}`}
                    >
                        <span
                            className={`flex h-5 w-8 items-center justify-center rounded-full ${on ? "bg-brand/12" : ""}`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[8px] font-semibold leading-none">{label}</span>
                    </div>
                );
            })}
        </div>
    );
}

function PhoneFrame({
    title,
    nav,
    children,
    privacyBlur,
}: {
    title: string;
    nav: NonNullable<TourSlide["nav"]>;
    children: ReactNode;
    privacyBlur?: boolean;
}) {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-line bg-cream shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between border-b border-line bg-paper/90 px-3 py-2">
                <p className="text-[11px] font-extrabold text-ink">{title}</p>
                <span className={`rounded-full p-1 text-muted ${privacyBlur ? "bg-brand/10 text-brand" : ""}`}>
                    <IconEye className="h-3.5 w-3.5" />
                </span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-cream">{children}</div>
            <MiniNav active={nav} />
        </div>
    );
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`rounded-xl border border-line bg-paper ${className}`}>{children}</div>;
}

function TourVisual({ kind, nav }: { kind: VisualKind; nav: NonNullable<TourSlide["nav"]> }) {
    if (kind === "welcome") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-xl font-extrabold text-white shadow-sm">
                        €
                    </div>
                    <div>
                        <p className="text-base font-extrabold text-ink">MyFinance</p>
                        <p className="mt-1 text-[11px] leading-snug text-muted">
                            Track income, expenses &amp; transfers — privately.
                        </p>
                    </div>
                    <div className="mt-1 w-full space-y-1.5 text-left">
                        <Surface className="flex items-center gap-2 px-3 py-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/10 text-[10px] font-bold text-brand">
                                1
                            </span>
                            <span className="text-[11px] font-semibold text-ink">Add bank accounts</span>
                        </Surface>
                        <Surface className="flex items-center gap-2 px-3 py-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/10 text-[10px] font-bold text-brand">
                                2
                            </span>
                            <span className="text-[11px] font-semibold text-ink">Set up categories</span>
                        </Surface>
                        <Surface className="flex items-center gap-2 px-3 py-2 opacity-50">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-chip text-[10px] font-bold text-muted">
                                3
                            </span>
                            <span className="text-[11px] font-semibold text-muted">Log transactions</span>
                        </Surface>
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "accounts") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-extrabold text-ink">Bank accounts</p>
                    <p className="text-[10px] leading-snug text-muted">
                        Settings → Bank accounts. Initial balance = money already there.
                    </p>
                    <Surface className="divide-y divide-line overflow-hidden">
                        {[
                            { name: "Imagin Main", bal: "€2.450,00", icon: true, def: true },
                            { name: "Cash", bal: "€85,00", icon: false, def: false },
                        ].map((a) => (
                            <div key={a.name} className="flex items-center gap-2 px-2.5 py-2">
                                <IconRadioDot checked={a.def} className="h-3.5 w-3.5 text-brand" />
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-chip text-muted">
                                    {a.icon ? <IconBank className="h-3.5 w-3.5" /> : <IconWallet className="h-3.5 w-3.5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-semibold text-ink">{a.name}</p>
                                    <p className="text-[10px] font-bold tabular-nums text-brand">{a.bal}</p>
                                </div>
                                <IconPencil className="h-3 w-3 text-muted" />
                            </div>
                        ))}
                    </Surface>
                    <div className="rounded-xl bg-brand py-2.5 text-center text-[11px] font-bold text-white">
                        Add account
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "categories") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-extrabold text-ink">Categories</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Expense</p>
                    <Surface className="divide-y divide-line overflow-hidden">
                        {[
                            { name: "Food & Drinks", color: "#bff3d4", def: true },
                            { name: "Transport", color: "#bfd4f3", def: false },
                            { name: "Social", color: "#e8f3bf", def: false },
                        ].map((c) => (
                            <div key={c.name} className="flex items-center gap-1.5 px-2 py-2">
                                <IconGrip className="h-3 w-3 text-muted" />
                                <IconRadioDot checked={c.def} className="h-3.5 w-3.5 text-brand" />
                                <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: c.color }}
                                />
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-chip text-ink">
                                    <IconUtensils className="h-3 w-3" />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-ink">
                                    {c.name}
                                </span>
                                <IconPencil className="h-3 w-3 text-muted" />
                            </div>
                        ))}
                    </Surface>
                    <div className="flex gap-1.5">
                        <div className="flex-1 rounded-lg bg-chip py-2 text-center text-[10px] font-bold text-muted">
                            Income
                        </div>
                        <div className="flex-1 rounded-lg bg-danger py-2 text-center text-[10px] font-bold text-white">
                            Expense
                        </div>
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "home") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="space-y-2.5 px-3 pt-3">
                    <Surface className="p-3 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Total Net Worth</p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand">€12.340,50</p>
                        <div className="mx-auto mt-2 h-6 w-28 rounded-md bg-brand/10" />
                    </Surface>
                    <div className="rounded-xl bg-brand py-2.5 text-center text-[11px] font-bold text-white shadow-sm">
                        + Add Transaction
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Your Accounts</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        <Surface className="p-2.5">
                            <div className="flex items-center gap-1">
                                <IconBank className="h-3 w-3 text-muted" />
                                <p className="truncate text-[9px] font-semibold text-muted">Imagin</p>
                            </div>
                            <p className="mt-1 text-sm font-bold tabular-nums text-brand">€2.450</p>
                        </Surface>
                        <Surface className="p-2.5">
                            <div className="flex items-center gap-1">
                                <IconWallet className="h-3 w-3 text-muted" />
                                <p className="truncate text-[9px] font-semibold text-muted">Cash</p>
                            </div>
                            <p className="mt-1 text-sm font-bold tabular-nums text-brand">€85</p>
                        </Surface>
                    </div>
                    <Surface className="flex items-center gap-2 px-2.5 py-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#bff3d4]/40 text-ink">
                            <IconUtensils className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-ink">Groceries</p>
                            <p className="truncate text-[9px] text-muted">Food · Imagin</p>
                        </div>
                        <p className="text-[11px] font-bold tabular-nums text-danger">−€42,30</p>
                    </Surface>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "add") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="flex h-full flex-col justify-end bg-ink/25 p-2">
                    <div className="rounded-t-2xl border border-line bg-paper p-3 shadow-lg">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-bold text-ink">Add Transaction</p>
                            <IconClose className="h-4 w-4 text-muted" />
                        </div>
                        <div className="mb-2 flex gap-1">
                            {["Expense", "Income", "Transfer"].map((t, i) => (
                                <div
                                    key={t}
                                    className={`flex-1 rounded-lg py-1.5 text-center text-[9px] font-bold ${
                                        i === 0 ? "bg-danger text-white" : "bg-chip text-muted"
                                    }`}
                                >
                                    {t}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1.5">
                            <div className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[10px] text-muted">
                                Amount (€) · 42,30
                            </div>
                            <div className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[10px] text-ink">
                                Food &amp; Drinks
                            </div>
                            <div className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[10px] text-ink">
                                Imagin Main
                            </div>
                        </div>
                        <div className="mt-2 rounded-xl bg-brand py-2.5 text-center text-[11px] font-bold text-white">
                            Save
                        </div>
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "transactions") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-extrabold text-ink">Transactions</p>
                    <div className="flex gap-1 overflow-hidden">
                        {["All", "Expense", "Income"].map((f, i) => (
                            <div
                                key={f}
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${
                                    i === 0 ? "bg-ink text-paper" : "bg-chip text-muted"
                                }`}
                            >
                                {f}
                            </div>
                        ))}
                    </div>
                    <Surface className="divide-y divide-line overflow-hidden">
                        {[
                            { t: "Groceries", s: "Food · 28/08", a: "−€42,30", c: "text-danger" },
                            { t: "Salary", s: "Salary · 01/08", a: "+€2.100,00", c: "text-brand" },
                            { t: "Transfer", s: "Cash → Imagin", a: "€50,00", c: "text-ink" },
                        ].map((r) => (
                            <div key={r.t} className="flex items-center gap-2 px-2.5 py-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-chip" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-semibold text-ink">{r.t}</p>
                                    <p className="truncate text-[9px] text-muted">{r.s}</p>
                                </div>
                                <p className={`text-[11px] font-bold tabular-nums ${r.c}`}>{r.a}</p>
                            </div>
                        ))}
                    </Surface>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "analytics") {
        return (
            <PhoneFrame title="Hi, Alex" nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-extrabold text-ink">Analytics</p>
                    <div className="flex gap-1">
                        {["Month", "3M", "Year"].map((p, i) => (
                            <div
                                key={p}
                                className={`flex-1 rounded-lg py-1.5 text-center text-[9px] font-bold ${
                                    i === 0 ? "bg-ink text-paper" : "bg-chip text-muted"
                                }`}
                            >
                                {p}
                            </div>
                        ))}
                    </div>
                    <Surface className="p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-muted">
                            Spending by category
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                            <div
                                className="h-16 w-16 shrink-0 rounded-full"
                                style={{
                                    background:
                                        "conic-gradient(#bff3d4 0 42%, #bfd4f3 42% 68%, #f3cebf 68% 100%)",
                                }}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                                {[
                                    { n: "Food", v: "42%" },
                                    { n: "Transport", v: "26%" },
                                    { n: "Other", v: "32%" },
                                ].map((r) => (
                                    <div key={r.n} className="flex justify-between text-[10px]">
                                        <span className="font-semibold text-ink">{r.n}</span>
                                        <span className="tabular-nums text-muted">{r.v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Surface>
                    <Surface className="flex h-14 items-end gap-1 px-3 pb-2 pt-3">
                        {[40, 55, 35, 70, 48, 62, 44].map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-t-sm bg-brand/70"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </Surface>
                </div>
            </PhoneFrame>
        );
    }

    return (
        <PhoneFrame title="Hi, Alex" nav={nav} privacyBlur>
            <div className="space-y-2.5 px-3 pt-3">
                <Surface className="p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Total Net Worth</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand blur-[6px] select-none">
                        €12.340,50
                    </p>
                </Surface>
                <div className="grid grid-cols-2 gap-1.5">
                    <Surface className="p-2.5">
                        <p className="text-[9px] font-semibold text-muted">Imagin</p>
                        <p className="mt-1 text-sm font-bold text-brand blur-[5px] select-none">€2.450</p>
                    </Surface>
                    <Surface className="p-2.5">
                        <p className="text-[9px] font-semibold text-muted">Cash</p>
                        <p className="mt-1 text-sm font-bold text-brand blur-[5px] select-none">€85</p>
                    </Surface>
                </div>
                <Surface className="px-3 py-2.5 text-center">
                    <p className="text-[10px] font-semibold text-ink">Amounts hidden</p>
                    <p className="mt-0.5 text-[9px] text-muted">Tap the eye in the header to show again</p>
                </Surface>
            </div>
        </PhoneFrame>
    );
}

export function GuidedTour({
    open,
    onClose,
}: {
    open: boolean;
    onClose: (reason: "complete" | "dismiss") => void;
}) {
    const [index, setIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<number | null>(null);
    const startedAt = useRef(0);

    const complete = useCallback(() => {
        markTourSeen();
        onClose("complete");
    }, [onClose]);

    const dismiss = useCallback(() => {
        markTourSeen();
        onClose("dismiss");
    }, [onClose]);

    const goTo = useCallback(
        (next: number) => {
            if (next >= TOUR_SLIDES.length) {
                complete();
                return;
            }
            if (next < 0) return;
            setIndex(next);
            setProgress(0);
            startedAt.current = performance.now();
        },
        [complete]
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
    const nav = slide.nav ?? "home";

    return (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/80 p-3 sm:items-center sm:p-6">
            <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-cream shadow-2xl sm:h-[min(740px,92dvh)]">
                <div className="flex gap-1 px-3 pt-3">
                    {TOUR_SLIDES.map((s, i) => (
                        <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                            <div
                                className="h-full rounded-full bg-brand transition-[width] duration-75 ease-linear"
                                style={{
                                    width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                    <div>
                        {slide.step ? (
                            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">{slide.step}</p>
                        ) : (
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                {index + 1} / {TOUR_SLIDES.length}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="Close tour"
                        className="rounded-full p-2 text-muted transition-colors hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="relative min-h-0 flex-1 px-4">
                    <div className="mx-auto h-full max-w-[280px]">
                        <TourVisual kind={slide.visual} nav={nav} />
                    </div>
                    <button
                        type="button"
                        aria-label="Previous"
                        className="absolute inset-y-0 left-0 w-[28%]"
                        onClick={() => goTo(index - 1)}
                    />
                    <button
                        type="button"
                        aria-label="Next"
                        className="absolute inset-y-0 right-0 w-[28%]"
                        onClick={() => goTo(index + 1)}
                    />
                </div>

                <div className="space-y-2 border-t border-line bg-paper px-5 pb-5 pt-4">
                    <h2 className="text-xl font-extrabold tracking-tight text-ink">{slide.title}</h2>
                    <p className="text-sm leading-relaxed text-muted">{slide.body}</p>
                    <button
                        type="button"
                        onClick={() => goTo(index + 1)}
                        className="btn-raised mt-1 w-full rounded-2xl py-3.5 text-base font-bold text-white select-none"
                    >
                        {index === TOUR_SLIDES.length - 1 ? "Set up my accounts" : "Next"}
                    </button>
                </div>
            </div>
        </div>
    );
}
