"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { type TFunction } from "@/i18n";
import { useT } from "@/i18n/I18nProvider";
import {
    IconArrowLeft,
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
const SETUP_STORAGE_KEY = "myfinance-setup-pending";
const STORY_MS = 8000;

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

export function isSetupPending(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const v = localStorage.getItem(SETUP_STORAGE_KEY);
        if (v === "1") return true;
        // Migrate older step-based key from the Settings handoff flow.
        const legacy = localStorage.getItem("myfinance-setup-guide");
        if (legacy === "accounts" || legacy === "categories" || legacy === "1") {
            localStorage.setItem(SETUP_STORAGE_KEY, "1");
            localStorage.removeItem("myfinance-setup-guide");
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function markSetupPending(): void {
    try {
        localStorage.setItem(SETUP_STORAGE_KEY, "1");
        localStorage.removeItem("myfinance-setup-guide");
    } catch {
        /* ignore */
    }
}

export function markSetupDone(): void {
    try {
        localStorage.setItem(SETUP_STORAGE_KEY, "0");
        localStorage.removeItem("myfinance-setup-guide");
    } catch {
        /* ignore */
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

export function getTourSlides(t: TFunction): TourSlide[] {
    return [
        {
            id: "welcome",
            title: t("tour.welcome.title"),
            body: t("tour.welcome.body"),
            visual: "welcome",
            nav: "home",
        },
        {
            id: "accounts",
            step: t("tour.accounts.step"),
            title: t("tour.accounts.title"),
            body: t("tour.accounts.body"),
            visual: "accounts",
            nav: "config",
        },
        {
            id: "categories",
            step: t("tour.categories.step"),
            title: t("tour.categories.title"),
            body: t("tour.categories.body"),
            visual: "categories",
            nav: "config",
        },
        {
            id: "home",
            title: t("tour.home.title"),
            body: t("tour.home.body"),
            visual: "home",
            nav: "home",
        },
        {
            id: "add",
            title: t("tour.add.title"),
            body: t("tour.add.body"),
            visual: "add",
            nav: "home",
        },
        {
            id: "transactions",
            title: t("tour.transactions.title"),
            body: t("tour.transactions.body"),
            visual: "transactions",
            nav: "transactions",
        },
        {
            id: "analytics",
            title: t("tour.analytics.title"),
            body: t("tour.analytics.body"),
            visual: "analytics",
            nav: "analytics",
        },
        {
            id: "privacy",
            title: t("tour.privacy.title"),
            body: t("tour.privacy.body"),
            visual: "privacy",
            nav: "home",
        },
    ];
}

export function isAccountFirstDay(createdAt: string | null | undefined): boolean {
    if (!createdAt) return false;
    const created = Date.parse(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z");
    if (Number.isNaN(created)) return false;
    return Date.now() - created < 24 * 60 * 60 * 1000;
}

function MiniNav({ active }: { active: NonNullable<TourSlide["nav"]> }) {
    const t = useT();
    const items = [
        { key: "home" as const, label: t("nav.home"), Icon: IconHome },
        { key: "transactions" as const, label: t("nav.txns"), Icon: IconList },
        { key: "todo" as const, label: t("nav.todo"), Icon: IconCheckSquare },
        { key: "analytics" as const, label: t("nav.analytics"), Icon: IconChart },
        { key: "config" as const, label: t("nav.settings"), Icon: IconSettings },
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
                <p className="text-[11px] font-semibold text-ink">{title}</p>
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
    const t = useT();
    const title = t("header.hi", { name: "Alex" });

    if (kind === "welcome") {
        return (
            <PhoneFrame title={title} nav={nav}>
                <div className="space-y-2.5 px-3 pt-3">
                    <Surface className="p-3 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted">{t("home.totalNetWorth")}</p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand">€352,78</p>
                        <div className="mx-auto mt-2 flex h-6 w-28 items-end gap-0.5 px-1">
                            {[35, 48, 40, 62, 55, 70, 58].map((h, i) => (
                                <div
                                    key={i}
                                    className="flex-1 rounded-t-sm bg-brand/50"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                        <p className="mt-1 text-[8px] font-medium text-muted">{t("home.past30Days")}</p>
                    </Surface>
                    <div className="rounded-xl bg-brand py-2.5 text-center text-[11px] font-bold text-white shadow-sm">
                        {t("home.addTransaction")}
                    </div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{t("home.yourAccounts")}</p>
                    <Surface className="overflow-hidden p-0">
                        <div className="grid grid-cols-2">
                            <div className="p-2.5">
                                <div className="flex items-center gap-1">
                                    <IconBank className="h-3 w-3 text-muted" />
                                    <p className="truncate text-[9px] font-semibold text-muted">{t("tour.visual.checking")}</p>
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-brand">€280,50</p>
                            </div>
                            <div className="border-l border-line p-2.5">
                                <div className="flex items-center gap-1">
                                    <IconWallet className="h-3 w-3 text-muted" />
                                    <p className="truncate text-[9px] font-semibold text-muted">{t("tour.visual.cash")}</p>
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-brand">€42,28</p>
                            </div>
                            <div className="border-t border-line p-2.5">
                                <div className="flex items-center gap-1">
                                    <IconBank className="h-3 w-3 text-muted" />
                                    <p className="truncate text-[9px] font-semibold text-muted">{t("tour.visual.savings")}</p>
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-brand">€30,00</p>
                            </div>
                        </div>
                    </Surface>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "accounts") {
        return (
            <PhoneFrame title={title} nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-semibold text-ink">{t("settings.bankAccounts")}</p>
                    <p className="text-[10px] leading-snug text-muted">{t("tour.visual.bankAccountsHint")}</p>
                    <Surface className="divide-y divide-line overflow-hidden">
                        {[
                            { name: "Imagin Main", bal: "€2.450,00", icon: true, def: true },
                            { name: t("tour.visual.cash"), bal: "€85,00", icon: false, def: false },
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
                        {t("tour.visual.addAccount")}
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "categories") {
        return (
            <PhoneFrame title={title} nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-semibold text-ink">{t("settings.categories")}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{t("type.expense")}</p>
                    <Surface className="divide-y divide-line overflow-hidden">
                        {[
                            { name: t("seeds.food"), color: "#bff3d4", def: true },
                            { name: t("tour.visual.transport"), color: "#bfd4f3", def: false },
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
                            {t("type.income")}
                        </div>
                        <div className="flex-1 rounded-lg bg-danger py-2 text-center text-[10px] font-bold text-white">
                            {t("type.expense")}
                        </div>
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "home") {
        return (
            <PhoneFrame title={title} nav={nav}>
                <div className="space-y-2.5 px-3 pt-3">
                    <Surface className="p-3 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted">{t("home.totalNetWorth")}</p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand">€12.340,50</p>
                        <div className="mx-auto mt-2 h-6 w-28 rounded-md bg-brand/10" />
                    </Surface>
                    <div className="rounded-xl bg-brand py-2.5 text-center text-[11px] font-bold text-white shadow-sm">
                        {t("home.addTransaction")}
                    </div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{t("home.yourAccounts")}</p>
                    <Surface className="overflow-hidden p-0">
                        <div className="grid grid-cols-2">
                            <div className="p-2.5">
                                <div className="flex items-center gap-1">
                                    <IconBank className="h-3 w-3 text-muted" />
                                    <p className="truncate text-[9px] font-semibold text-muted">Imagin</p>
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-brand">€2.450</p>
                            </div>
                            <div className="border-l border-line p-2.5">
                                <div className="flex items-center gap-1">
                                    <IconWallet className="h-3 w-3 text-muted" />
                                    <p className="truncate text-[9px] font-semibold text-muted">{t("tour.visual.cash")}</p>
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-brand">€85</p>
                            </div>
                        </div>
                    </Surface>
                    <Surface className="flex items-center gap-2 px-2.5 py-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#bff3d4]/40 text-ink">
                            <IconUtensils className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-ink">{t("tour.visual.groceries")}</p>
                            <p className="truncate text-[9px] text-muted">{t("tour.visual.food")} · Imagin</p>
                        </div>
                        <p className="text-[11px] font-bold tabular-nums text-danger">−€42,30</p>
                    </Surface>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "add") {
        return (
            <PhoneFrame title={title} nav={nav}>
                <div className="flex h-full flex-col justify-end bg-ink/25 p-2">
                    <div className="rounded-t-2xl border border-line bg-paper p-3 shadow-lg">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-bold text-ink">{t("tx.addTitle")}</p>
                            <IconClose className="h-4 w-4 text-muted" />
                        </div>
                        <div className="mb-2 flex gap-1">
                            {[t("type.expense"), t("type.income"), t("type.transfer")].map((label, i) => (
                                <div
                                    key={label}
                                    className={`flex-1 rounded-lg py-1.5 text-center text-[9px] font-bold ${
                                        i === 0 ? "bg-danger text-white" : "bg-chip text-muted"
                                    }`}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1.5">
                            <div className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[10px] text-muted">
                                {t("tour.visual.amountExample")}
                            </div>
                            <div className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[10px] text-ink">
                                {t("seeds.food")}
                            </div>
                            <div className="rounded-lg border border-line bg-cream px-2.5 py-2 text-[10px] text-ink">
                                Imagin Main
                            </div>
                        </div>
                        <div className="mt-2 rounded-xl bg-brand py-2.5 text-center text-[11px] font-bold text-white">
                            {t("common.save")}
                        </div>
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === "transactions") {
        return (
            <PhoneFrame title={title} nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-semibold text-ink">{t("tx.title")}</p>
                    <div className="flex gap-1 overflow-hidden">
                        {[t("tour.visual.all"), t("type.expense"), t("type.income")].map((f, i) => (
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
                            { heading: t("tour.visual.groceries"), s: `${t("tour.visual.food")} · 28/08`, a: "−€42,30", c: "text-danger" },
                            { heading: t("tour.visual.salary"), s: `${t("tour.visual.salary")} · 01/08`, a: "+€2.100,00", c: "text-brand" },
                            { heading: t("type.transfer"), s: `${t("tour.visual.cash")} → Imagin`, a: "€50,00", c: "text-ink" },
                        ].map((r) => (
                            <div key={r.heading} className="flex items-center gap-2 px-2.5 py-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-chip" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-semibold text-ink">{r.heading}</p>
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
            <PhoneFrame title={title} nav={nav}>
                <div className="space-y-2 px-3 pt-3">
                    <p className="text-sm font-semibold text-ink">{t("analytics.title")}</p>
                    <div className="flex gap-1">
                        {[t("analytics.periodMonth"), t("analytics.period3m"), t("analytics.periodYear")].map((p, i) => (
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
                            {t("analytics.spendingByCategory")}
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
                                    { n: t("tour.visual.food"), v: "42%" },
                                    { n: t("tour.visual.transport"), v: "26%" },
                                    { n: t("common.other"), v: "32%" },
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
        <PhoneFrame title={title} nav={nav} privacyBlur>
            <div className="space-y-2.5 px-3 pt-3">
                <Surface className="p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted">{t("home.totalNetWorth")}</p>
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
                        <p className="text-[9px] font-semibold text-muted">{t("tour.visual.cash")}</p>
                        <p className="mt-1 text-sm font-bold text-brand blur-[5px] select-none">€85</p>
                    </Surface>
                </div>
                <Surface className="px-3 py-2.5 text-center">
                    <p className="text-[10px] font-semibold text-ink">{t("tour.amountsHidden")}</p>
                    <p className="mt-0.5 text-[9px] text-muted">{t("tour.tapEye")}</p>
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
    const t = useT();
    const slides = getTourSlides(t);
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
            if (next >= slides.length) {
                complete();
                return;
            }
            if (next < 0) return;
            setIndex(next);
            setProgress(0);
            startedAt.current = performance.now();
        },
        [complete, slides.length]
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

    const slide = slides[index];
    const nav = slide.nav ?? "home";

    return (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/80 p-3 sm:items-center sm:p-6">
            <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-cream shadow-2xl sm:h-[min(740px,92dvh)]">
                <div className="flex gap-1 px-3 pt-3">
                    {slides.map((s, i) => (
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

                <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold tabular-nums tracking-wide text-muted">
                            {index + 1}
                            <span className="font-semibold text-line"> / </span>
                            {slides.length}
                        </p>
                        {slide.step && (
                            <p className="mt-0.5 inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                                {slide.step}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label={t("tour.close")}
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
                        aria-label={t("common.previous")}
                        className="absolute inset-y-0 left-0 w-[28%]"
                        onClick={() => goTo(index - 1)}
                    />
                    <button
                        type="button"
                        aria-label={t("common.next")}
                        className="absolute inset-y-0 right-0 w-[28%]"
                        onClick={() => goTo(index + 1)}
                    />
                </div>

                <div className="space-y-3 border-t border-line bg-paper px-5 pb-5 pt-4">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-ink">{slide.title}</h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{slide.body}</p>
                    </div>
                    <div className="flex gap-2">
                        {index > 0 && (
                            <button
                                type="button"
                                onClick={() => goTo(index - 1)}
                                className="flex items-center justify-center gap-1.5 rounded-2xl bg-chip px-4 py-3.5 text-base font-bold text-ink select-none hover:bg-chip-hover"
                            >
                                <IconArrowLeft className="h-5 w-5" />
                                {t("common.back")}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => goTo(index + 1)}
                            className="btn-raised min-w-0 flex-1 rounded-2xl py-3.5 text-base font-bold text-white select-none"
                        >
                            {index === slides.length - 1 ? t("tour.setUpAccounts") : t("common.next")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
