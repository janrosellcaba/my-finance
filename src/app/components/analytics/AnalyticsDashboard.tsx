"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
    Bar,
    BarChart,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { AnalyticsResult, CategoryRow } from "@/lib/analytics";
import { type Account, type Category, type Transaction, AMOUNT_MASK, formatCurrency, formatDate } from "../../shared";
import { TransactionCard } from "../TransactionCard";
import { AccountIcon, CategoryIcon, IconClose } from "../icons";
import { Card, DeltaPill, EmptyNote, Section, StatTile } from "./primitives";

const AXIS = "#918c7c";
const BRAND = "#1f7a54";
const DANGER = "#a8402f";

function moneyTick(v: number, privacyMode: boolean): string {
    return privacyMode ? AMOUNT_MASK : String(Math.round(v));
}

type Drill = {
    title: string;
    categoryId: string;
    type: "income" | "expense";
    highlightId?: string;
};

export function AnalyticsDashboard({
    data,
    privacyMode,
    accounts,
    categories,
    selectedAccountId,
    focusName,
    onSelectAccount,
}: {
    data: AnalyticsResult;
    privacyMode: boolean;
    accounts: Account[];
    categories: Category[];
    selectedAccountId: string;
    focusName: string | null;
    onSelectAccount: (id: string) => void;
}) {
    const { summary, comparison, period, health } = data;
    const money = (n: number) => formatCurrency(n, privacyMode);
    const [scoreOpen, setScoreOpen] = useState(false);
    const [drill, setDrill] = useState<Drill | null>(null);

    const scoreTone =
        health.score === null ? "ink" : health.score >= 55 ? "brand" : health.score >= 35 ? "ink" : "danger";

    const focusNote = focusName ?? undefined;

    return (
        <div className="space-y-6 lg:space-y-8">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <button
                    type="button"
                    onClick={() => {
                        setDrill(null);
                        setScoreOpen(true);
                    }}
                    aria-haspopup="dialog"
                    className="col-span-2 flex flex-col rounded-2xl border border-line bg-paper p-4 text-left shadow-sm transition-colors duration-150 hover:bg-chip/50 lg:col-span-1"
                >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Score</p>
                    <p
                        className={`mt-1 text-3xl font-extrabold tabular-nums ${
                            scoreTone === "brand" ? "text-brand" : scoreTone === "danger" ? "text-danger" : "text-ink"
                        } ${privacyMode ? "blur-[7px] select-none opacity-70" : ""}`}
                    >
                        {health.score === null ? "—" : health.score}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted">{health.label}</p>
                </button>
                <StatTile
                    label="Spent"
                    value={money(summary.expenses)}
                    tone="danger"
                    delta={comparison.expensesDelta}
                    privacyMode={privacyMode}
                    goodWhenUp={false}
                    footnote={
                        summary.expenseCount === 0
                            ? "No purchases"
                            : privacyMode
                              ? `${summary.expenseCount} purchase${summary.expenseCount === 1 ? "" : "s"}`
                              : `${summary.expenseCount} purchase${summary.expenseCount === 1 ? "" : "s"} · ${money(data.dailySpend)}/day`
                    }
                />
                <StatTile
                    label="Earned"
                    value={money(summary.income)}
                    tone="brand"
                    delta={comparison.incomeDelta}
                    privacyMode={privacyMode}
                />
                <StatTile
                    label={summary.netSavings >= 0 ? "Left over" : "Overspent"}
                    value={money(Math.abs(summary.netSavings))}
                    tone={summary.netSavings >= 0 ? "brand" : "danger"}
                    delta={comparison.savingsDelta}
                    privacyMode={privacyMode}
                    className="col-span-2 lg:col-span-1"
                    footnote={
                        summary.savingsRate === null || privacyMode
                            ? undefined
                            : `${summary.savingsRate.toFixed(0)}% of income`
                    }
                />
            </div>

            {data.accountActivity.length > 1 && (
                <Section title="By account">
                    <AccountCards
                        rows={data.accountActivity}
                        accounts={accounts}
                        privacyMode={privacyMode}
                        selectedId={selectedAccountId}
                        onSelect={onSelectAccount}
                    />
                </Section>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-7">
                    <Section title="Spending by category" subtitle={focusNote}>
                        <CategoryBars
                            rows={data.spendingByCategory}
                            privacyMode={privacyMode}
                            showPie
                            onSelect={(row) => {
                                setScoreOpen(false);
                                setDrill({ title: row.name, categoryId: row.categoryId, type: "expense" });
                            }}
                        />
                    </Section>
                </div>
                <div className="lg:col-span-5">
                    <Section title="Biggest purchases" subtitle={focusNote}>
                        <TopPurchases
                            rows={data.topExpenses}
                            privacyMode={privacyMode}
                            onSelect={(row) => {
                                setScoreOpen(false);
                                setDrill({
                                    title: row.categoryName,
                                    categoryId: row.categoryId,
                                    type: "expense",
                                    highlightId: row.id,
                                });
                            }}
                        />
                    </Section>
                </div>

                <div className="lg:col-span-12">
                    <Section title="Month by month">
                        <MonthlyChart data={data} privacyMode={privacyMode} />
                    </Section>
                </div>

                {data.netWorthByAccount.length > 1 && (
                    <div className="lg:col-span-7">
                        <Section title="Account balances">
                            <AccountBalances
                                rows={data.netWorthByAccount}
                                accounts={accounts}
                                privacyMode={privacyMode}
                                selectedId={selectedAccountId}
                                onSelect={onSelectAccount}
                            />
                        </Section>
                    </div>
                )}
                {data.incomeBySource.length > 1 && (
                    <div className="lg:col-span-5">
                        <Section title="Income by category" subtitle={focusNote}>
                            <CategoryBars
                                rows={data.incomeBySource}
                                privacyMode={privacyMode}
                                tone="brand"
                                onSelect={(row) => {
                                    setScoreOpen(false);
                                    setDrill({ title: row.name, categoryId: row.categoryId, type: "income" });
                                }}
                            />
                        </Section>
                    </div>
                )}
            </div>

            <Section title="Net worth" subtitle="All time">
                <LifetimeNetWorth data={data} accounts={accounts} privacyMode={privacyMode} />
            </Section>

            {scoreOpen && (
                <Sheet title="Score" subtitle={health.label} onClose={() => setScoreOpen(false)}>
                    <ScoreBreakdown health={health} privacyMode={privacyMode} />
                </Sheet>
            )}

            {drill && (
                <CategorySheet
                    drill={drill}
                    start={period.start}
                    end={period.end}
                    accountId={selectedAccountId === "all" ? null : selectedAccountId}
                    accounts={accounts}
                    categories={categories}
                    privacyMode={privacyMode}
                    onClose={() => setDrill(null)}
                />
            )}
        </div>
    );
}

function ScoreBreakdown({
    health,
    privacyMode,
}: {
    health: AnalyticsResult["health"];
    privacyMode: boolean;
}) {
    if (health.parts.length === 0) {
        return (
            <p className="text-sm text-muted">
                Add a payday and a few weeks of spending and a score will show up here.
            </p>
        );
    }

    return (
        <div className={`space-y-4 ${privacyMode ? "blur-[5px] select-none opacity-70" : ""}`}>
            <p className="text-4xl font-extrabold tabular-nums text-ink">
                {health.score === null ? "—" : health.score}
            </p>
            {health.parts.map((p) => (
                <div key={p.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold text-ink">{p.label}</span>
                        <span className="shrink-0 font-bold tabular-nums text-ink">{p.score}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-chip">
                        <div
                            className={`h-full rounded-full ${p.score >= 55 ? "bg-brand" : "bg-danger"}`}
                            style={{ width: `${Math.max(4, p.score)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{p.note}</p>
                </div>
            ))}
            <p className="text-xs text-muted">Scored against your own numbers, not a generic budget rule.</p>
        </div>
    );
}

const PIE_FALLBACK = ["#c45c4a", "#d4a04a", "#6a9a6a", "#5a8aaa", "#8a6aaa", "#c47a6a", "#7a8a5a"];
const OTHER_FILL = "#a39e8e";

type PieSlice = {
    name: string;
    amount: number;
    color: string;
    share: number | null;
    row: CategoryRow | null;
};

function slicesFromRows(rows: CategoryRow[]): PieSlice[] {
    const colorOf = (r: CategoryRow, i: number) => r.color ?? PIE_FALLBACK[i % PIE_FALLBACK.length];
    const limit = 7;
    if (rows.length <= limit) {
        return rows.map((r, i) => ({
            name: r.name,
            amount: r.amount,
            color: colorOf(r, i),
            share: r.share,
            row: r,
        }));
    }
    const head = rows.slice(0, limit - 1);
    const tail = rows.slice(limit - 1);
    const otherAmount = tail.reduce((s, r) => s + r.amount, 0);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return [
        ...head.map((r, i) => ({
            name: r.name,
            amount: r.amount,
            color: colorOf(r, i),
            share: r.share,
            row: r,
        })),
        {
            name: "Other",
            amount: otherAmount,
            color: OTHER_FILL,
            share: total === 0 ? null : Math.round((otherAmount / total) * 100),
            row: null,
        },
    ];
}

function CategoryPie({
    rows,
    privacyMode,
    onSelect,
}: {
    rows: CategoryRow[];
    privacyMode: boolean;
    onSelect: (row: CategoryRow) => void;
}) {
    const slices = slicesFromRows(rows);
    const total = rows.reduce((s, r) => s + r.amount, 0);

    return (
        <div className="relative mx-auto w-full max-w-[260px]">
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie
                        data={slices}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={84}
                        paddingAngle={slices.length > 1 ? 2 : 0}
                        cornerRadius={3}
                        startAngle={90}
                        endAngle={-270}
                        stroke="var(--color-paper)"
                        strokeWidth={2}
                        label={false}
                        labelLine={false}
                        isAnimationActive={false}
                        rootTabIndex={-1}
                        style={{ cursor: "pointer", outline: "none" }}
                        onClick={(_d, index) => {
                            const row = slices[index]?.row;
                            if (row) onSelect(row);
                        }}
                    >
                        {slices.map((s) => (
                            <Cell key={s.row?.categoryId ?? s.name} fill={s.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        isAnimationActive={false}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as unknown as PieSlice | undefined;
                            if (!d) return null;
                            return (
                                <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-sm">
                                    <p className="font-semibold text-ink">{d.name}</p>
                                    <p
                                        className={`mt-0.5 tabular-nums text-muted ${
                                            privacyMode ? "blur-[5px] select-none opacity-70" : ""
                                        }`}
                                    >
                                        {formatCurrency(d.amount, privacyMode)}
                                        {d.share !== null && !privacyMode ? ` · ${d.share.toFixed(0)}%` : ""}
                                    </p>
                                </div>
                            );
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[7.25rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Spent</p>
                <p
                    className={`text-center text-base font-extrabold leading-tight tabular-nums text-ink ${
                        privacyMode ? "blur-[6px] select-none opacity-70" : ""
                    }`}
                >
                    {formatCurrency(total, privacyMode)}
                </p>
            </div>
        </div>
    );
}

function CategoryBars({
    rows,
    privacyMode,
    tone = "danger",
    showPie = false,
    onSelect,
}: {
    rows: CategoryRow[];
    privacyMode: boolean;
    tone?: "danger" | "brand";
    showPie?: boolean;
    onSelect: (row: CategoryRow) => void;
}) {
    if (rows.length === 0) return <EmptyNote>Nothing in this period.</EmptyNote>;

    const max = Math.max(...rows.map((r) => r.amount), 1);
    const fill = tone === "brand" ? "bg-brand" : "bg-danger";
    const colorOf = (r: CategoryRow, i: number) => r.color ?? PIE_FALLBACK[i % PIE_FALLBACK.length];

    const pie = showPie && rows.length >= 2;

    return (
        <Card className="!p-2">
            <div className={pie ? "lg:flex lg:items-center" : undefined}>
                {pie && (
                    <div className="lg:w-60 lg:shrink-0">
                        <CategoryPie rows={rows} privacyMode={privacyMode} onSelect={onSelect} />
                    </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                    {rows.map((r, i) => (
                        <button
                            key={r.categoryId}
                            type="button"
                            onClick={() => onSelect(r)}
                            className="w-full rounded-xl px-2 py-2.5 text-left transition-colors duration-150 hover:bg-chip/70"
                        >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: colorOf(r, i) }}
                                />
                                {r.icon && (
                                    <span
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                                        style={{
                                            backgroundColor: r.color ? `${r.color}25` : undefined,
                                            color: r.color ?? undefined,
                                        }}
                                    >
                                        <CategoryIcon iconKey={r.icon} className="h-3.5 w-3.5" />
                                    </span>
                                )}
                                <span className="min-w-0 truncate font-semibold text-ink">{r.name}</span>
                            </span>
                            <span className="flex shrink-0 items-baseline gap-2">
                                <DeltaPill
                                    delta={
                                        r.changePct === null
                                            ? null
                                            : {
                                                  current: r.amount,
                                                  previous: r.prevAmount,
                                                  change: r.amount - r.prevAmount,
                                                  changePct: r.changePct,
                                              }
                                    }
                                    privacyMode={privacyMode}
                                    goodWhenUp={tone === "brand"}
                                />
                                <span
                                    className={`font-bold tabular-nums ${tone === "brand" ? "text-brand" : "text-ink"} ${
                                        privacyMode ? "blur-[6px] select-none opacity-70" : ""
                                    }`}
                                >
                                    {formatCurrency(r.amount, privacyMode)}
                                </span>
                            </span>
                        </div>
                        {!pie && (
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-chip">
                                <div
                                    className={`h-full rounded-full ${r.color ? "" : fill}`}
                                    style={{
                                        width: `${Math.max(2, (r.amount / max) * 100)}%`,
                                        backgroundColor: r.color ?? undefined,
                                    }}
                                />
                            </div>
                        )}
                        <p className="mt-1 text-[11px] text-muted">
                            {r.txCount} time{r.txCount === 1 ? "" : "s"}
                            {r.share !== null && !privacyMode ? ` · ${r.share.toFixed(0)}%` : ""}
                        </p>
                    </button>
                ))}
                </div>
            </div>
        </Card>
    );
}

function TopPurchases({
    rows,
    privacyMode,
    onSelect,
}: {
    rows: AnalyticsResult["topExpenses"];
    privacyMode: boolean;
    onSelect: (row: AnalyticsResult["topExpenses"][number]) => void;
}) {
    if (rows.length === 0) return <EmptyNote>No purchases this period.</EmptyNote>;

    return (
        <Card className="divide-y divide-line !p-0">
            {rows.map((r) => (
                <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelect(r)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-chip/70"
                >
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{r.description}</p>
                        <p className="truncate text-xs text-muted">
                            {r.categoryName} · {formatDate(r.date)}
                        </p>
                    </div>
                    <p
                        className={`shrink-0 font-bold tabular-nums text-danger ${
                            privacyMode ? "blur-[6px] select-none opacity-70" : ""
                        }`}
                    >
                        −{formatCurrency(r.amount, privacyMode)}
                    </p>
                </button>
            ))}
        </Card>
    );
}

function MonthlyChart({
    data,
    privacyMode,
}: {
    data: AnalyticsResult;
    privacyMode: boolean;
}) {
    if (data.monthlySeries.every((m) => m.income === 0 && m.expenses === 0)) {
        return <EmptyNote>Not enough history for a trend yet.</EmptyNote>;
    }

    return (
        <Card>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthlySeries} barGap={2}>
                    <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                        stroke={AXIS}
                        tick={{ fontSize: 11 }}
                        width={56}
                        tickFormatter={(v: number) => moneyTick(v, privacyMode)}
                    />
                    <Tooltip
                        formatter={(v, name) => [
                            typeof v === "number" ? formatCurrency(v, privacyMode) : String(v),
                            name === "income" ? "Earned" : "Spent",
                        ]}
                        isAnimationActive={false}
                    />
                    <Bar
                        dataKey="income"
                        name="income"
                        fill={BRAND}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={28}
                        isAnimationActive={false}
                    />
                    <Bar
                        dataKey="expenses"
                        name="expenses"
                        fill={DANGER}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={28}
                        isAnimationActive={false}
                    />
                </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-brand" /> Earned
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-danger" /> Spent
                </span>
            </div>
        </Card>
    );
}

type BalanceSlice = {
    accountId: string;
    name: string;
    amount: number;
    prevAmount: number;
    changePct: number | null;
    color: string;
    share: number | null;
    icon: string | null;
};

function AccountBalances({
    rows,
    accounts,
    privacyMode,
    selectedId,
    onSelect,
}: {
    rows: AnalyticsResult["netWorthByAccount"];
    accounts: Account[];
    privacyMode: boolean;
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const total = rows.reduce((s, r) => s + r.current, 0);
    const items: BalanceSlice[] = [...rows]
        .sort((a, b) => b.current - a.current)
        .map((r, i) => ({
            accountId: r.accountId,
            name: r.name,
            amount: r.current,
            prevAmount: r.prevAmount,
            changePct: r.changePct,
            color: PIE_FALLBACK[i % PIE_FALLBACK.length],
            share: total === 0 ? null : Math.round((r.current / total) * 100),
            icon: accounts.find((a) => a.id === r.accountId)?.icon ?? null,
        }));
    const pieData = items.filter((r) => r.amount > 0);

    if (items.length === 0) {
        return <EmptyNote>No accounts to show.</EmptyNote>;
    }

    return (
        <Card className="!p-2">
            <div className={pieData.length >= 1 ? "lg:flex lg:items-center" : undefined}>
                {pieData.length >= 1 && (
                    <div className="lg:w-60 lg:shrink-0">
                        <div className="relative mx-auto w-full max-w-[260px]">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="amount"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={84}
                                        paddingAngle={pieData.length > 1 ? 2 : 0}
                                        cornerRadius={3}
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="var(--color-paper)"
                                        strokeWidth={2}
                                        label={false}
                                        labelLine={false}
                                        isAnimationActive={false}
                                        rootTabIndex={-1}
                                    >
                                        {pieData.map((s) => (
                                            <Cell key={s.accountId} fill={s.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        isAnimationActive={false}
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0].payload as unknown as BalanceSlice | undefined;
                                            if (!d) return null;
                                            return (
                                                <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-sm">
                                                    <p className="font-semibold text-ink">{d.name}</p>
                                                    <p
                                                        className={`mt-0.5 tabular-nums text-muted ${
                                                            privacyMode ? "blur-[5px] select-none opacity-70" : ""
                                                        }`}
                                                    >
                                                        {formatCurrency(d.amount, privacyMode)}
                                                        {d.share !== null && !privacyMode
                                                            ? ` · ${d.share.toFixed(0)}%`
                                                            : ""}
                                                    </p>
                                                </div>
                                            );
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[7.25rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total</p>
                                <p
                                    className={`text-center text-base font-extrabold leading-tight tabular-nums ${
                                        total >= 0 ? "text-ink" : "text-danger"
                                    } ${privacyMode ? "blur-[6px] select-none opacity-70" : ""}`}
                                >
                                    {formatCurrency(total, privacyMode)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                    {items.map((r) => {
                        const active = selectedId === r.accountId;
                        return (
                            <button
                                key={r.accountId}
                                type="button"
                                onClick={() => onSelect(active ? "all" : r.accountId)}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-150 ${
                                    active ? "bg-chip/80" : "hover:bg-chip/70"
                                }`}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: r.color }}
                                    />
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-chip text-muted">
                                        <AccountIcon iconKey={r.icon ?? "wallet"} className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="min-w-0 truncate font-semibold text-ink">{r.name}</span>
                                </span>
                                <span className="flex shrink-0 items-baseline gap-2">
                                    <DeltaPill
                                        delta={
                                            r.changePct === null
                                                ? null
                                                : {
                                                      current: r.amount,
                                                      previous: r.prevAmount,
                                                      change: r.amount - r.prevAmount,
                                                      changePct: r.changePct,
                                                  }
                                        }
                                        privacyMode={privacyMode}
                                    />
                                    <span
                                        className={`font-bold tabular-nums ${
                                            r.amount >= 0 ? "text-ink" : "text-danger"
                                        } ${privacyMode ? "blur-[6px] select-none opacity-70" : ""}`}
                                    >
                                        {formatCurrency(r.amount, privacyMode)}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}

function LifetimeNetWorth({
    data,
    accounts,
    privacyMode,
}: {
    data: AnalyticsResult;
    accounts: Account[];
    privacyMode: boolean;
}) {
    const [accountId, setAccountId] = useState("all");

    useEffect(() => {
        if (accountId !== "all" && !accounts.some((a) => a.id === accountId)) {
            setAccountId("all");
        }
    }, [accounts, accountId]);

    const selected = data.netWorthByAccount.find((a) => a.accountId === accountId);
    const series = selected ? selected.series : data.netWorth.series;
    const current = selected ? selected.current : data.netWorth.current;
    const first = series[0]?.netWorth;
    const change = first === undefined ? 0 : current - first;

    if (series.length < 2) {
        return (
            <EmptyNote>
                Not enough history yet. Current net worth:{" "}
                <span className="font-semibold text-ink">{formatCurrency(current, privacyMode)}</span>.
            </EmptyNote>
        );
    }

    return (
        <Card>
            {accounts.length > 1 && (
                <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
                    <button
                        type="button"
                        onClick={() => setAccountId("all")}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 select-none ${
                            accountId === "all" ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                        }`}
                    >
                        All accounts
                    </button>
                    {accounts.map((a) => (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => setAccountId(a.id)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 select-none ${
                                accountId === a.id ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {a.name}
                        </button>
                    ))}
                </div>
            )}
            <p
                className={`text-2xl font-extrabold tabular-nums ${privacyMode ? "blur-[6px] select-none opacity-70" : ""} ${
                    current >= 0 ? "text-ink" : "text-danger"
                }`}
            >
                {formatCurrency(current, privacyMode)}
            </p>
            {change !== 0 && (
                <p
                    className={`mt-0.5 text-xs font-semibold tabular-nums ${
                        change >= 0 ? "text-brand" : "text-danger"
                    } ${privacyMode ? "blur-[5px] select-none opacity-70" : ""}`}
                >
                    {change >= 0 ? "+" : ""}
                    {formatCurrency(change, privacyMode)} since {formatDate(series[0].date)}
                </p>
            )}
            <div className="mt-3">
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={series}>
                        <XAxis
                            dataKey="date"
                            stroke={AXIS}
                            tick={{ fontSize: 11 }}
                            minTickGap={40}
                            tickFormatter={(d: string) => formatDate(d).slice(3)}
                        />
                        <YAxis
                            stroke={AXIS}
                            tick={{ fontSize: 11 }}
                            width={56}
                            tickFormatter={(v: number) => moneyTick(v, privacyMode)}
                        />
                        <Tooltip
                            formatter={(v) => (typeof v === "number" ? formatCurrency(v, privacyMode) : String(v))}
                            labelFormatter={(l) => (typeof l === "string" ? formatDate(l) : String(l))}
                            isAnimationActive={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="netWorth"
                            stroke={BRAND}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

function AccountCards({
    rows,
    accounts,
    privacyMode,
    selectedId,
    onSelect,
}: {
    rows: AnalyticsResult["accountActivity"];
    accounts: Account[];
    privacyMode: boolean;
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
                const active = selectedId === r.accountId;
                const icon = accounts.find((a) => a.id === r.accountId)?.icon ?? "wallet";
                return (
                    <button
                        key={r.accountId}
                        type="button"
                        onClick={() => onSelect(active ? "all" : r.accountId)}
                        className={`rounded-2xl border p-4 text-left shadow-sm transition-colors duration-150 ${
                            active ? "border-ink bg-chip/80" : "border-line bg-paper hover:bg-chip/50"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-chip text-muted">
                                <AccountIcon iconKey={icon} className="h-3.5 w-3.5" />
                            </span>
                            <p className="truncate text-sm font-bold text-ink">{r.name}</p>
                        </div>
                        <p
                            className={`mt-1 text-lg font-extrabold tabular-nums ${
                                r.net >= 0 ? "text-brand" : "text-danger"
                            } ${privacyMode ? "blur-[6px] select-none opacity-70" : ""}`}
                        >
                            {r.net >= 0 ? "+" : ""}
                            {formatCurrency(r.net, privacyMode)}
                        </p>
                        <p className={`mt-1 text-xs text-muted ${privacyMode ? "blur-[5px] select-none opacity-70" : ""}`}>
                            in {formatCurrency(r.income, privacyMode)} · out {formatCurrency(r.expenses, privacyMode)}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}

function Sheet({
    title,
    subtitle,
    onClose,
    children,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-xl sm:rounded-3xl"
            >
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-ink">{title}</p>
                        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function CategorySheet({
    drill,
    start,
    end,
    accountId,
    accounts,
    categories,
    privacyMode,
    onClose,
}: {
    drill: Drill;
    start: string;
    end: string;
    accountId: string | null;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onClose: () => void;
}) {
    const [txs, setTxs] = useState<Transaction[] | null>(null);
    const [truncated, setTruncated] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams({
            category: drill.categoryId,
            type: drill.type,
            startDate: start,
            endDate: end,
        });
        if (accountId) params.set("account", accountId);
        let cancelled = false;
        setTxs(null);
        setTruncated(false);
        fetch(`/api/transactions?${params.toString()}`)
            .then((res) => res.json())
            .then((json: { success?: boolean; transactions?: Transaction[]; nextCursor?: unknown }) => {
                if (cancelled) return;
                if (json.success && json.transactions) {
                    setTxs(json.transactions);
                    setTruncated(Boolean(json.nextCursor));
                } else {
                    setTxs([]);
                }
            })
            .catch(() => {
                if (!cancelled) setTxs([]);
            });
        return () => {
            cancelled = true;
        };
    }, [drill.categoryId, drill.type, start, end, accountId]);

    return (
        <Sheet title={drill.title} subtitle="This period" onClose={onClose}>
            {txs === null ? (
                <div className="animate-pulse space-y-2 py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-xl bg-chip" />
                    ))}
                </div>
            ) : txs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No transactions in this period.</p>
            ) : (
                <>
                    {truncated && (
                        <p className="mb-2 text-xs text-muted">Showing the latest 50.</p>
                    )}
                    <div className="divide-y divide-line rounded-2xl border border-line">
                        {txs.map((tx) => (
                            <div
                                key={tx.id}
                                className={drill.highlightId === tx.id ? "bg-chip/80" : undefined}
                            >
                                <TransactionCard
                                    tx={tx}
                                    accounts={accounts}
                                    categories={categories}
                                    privacyMode={privacyMode}
                                    accountBalance={tx.balanceAfter}
                                    compact
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Sheet>
    );
}
