"use client";

import { useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsResult } from "@/lib/analytics";
import { AMOUNT_MASK, formatCurrency, formatDate } from "../../shared";
import { Card, DeltaPill, EmptyNote, Section, StatTile } from "./primitives";

const AXIS = "#918c7c";
const BRAND = "#1f7a54";
const DANGER = "#a8402f";

function moneyTick(v: number, privacyMode: boolean): string {
    return privacyMode ? AMOUNT_MASK : String(Math.round(v));
}

export function AnalyticsDashboard({ data, privacyMode }: { data: AnalyticsResult; privacyMode: boolean }) {
    const { summary, comparison, period } = data;
    const money = (n: number) => formatCurrency(n, privacyMode);

    return (
        <div className="space-y-6 lg:space-y-8">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="col-span-2 lg:col-span-1">
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
                </div>
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
                    footnote={
                        summary.savingsRate === null || privacyMode
                            ? undefined
                            : `${summary.savingsRate.toFixed(0)}% of income`
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-7">
                    <Section
                        title="Where it went"
                        info="How this period's spending splits across categories. Percentages are of spending, not of income."
                    >
                        <CategoryBars rows={data.spendingByCategory} privacyMode={privacyMode} />
                    </Section>
                </div>
                <div className="lg:col-span-5">
                    <Section title="Biggest purchases">
                        <TopPurchases rows={data.topExpenses} privacyMode={privacyMode} />
                    </Section>
                </div>

                <div className="lg:col-span-6">
                    <Section
                        title="Month by month"
                        subtitle={period.mode === "month" ? "This month plus the five before it" : undefined}
                    >
                        <MonthlyChart data={data} privacyMode={privacyMode} />
                    </Section>
                </div>
                <div className="lg:col-span-6">
                    <Section title="Net worth">
                        <NetWorthChart data={data} privacyMode={privacyMode} />
                    </Section>
                </div>

                {data.incomeBySource.length > 0 && (
                    <div className="lg:col-span-6">
                        <Section title="Where it came from">
                            <CategoryBars rows={data.incomeBySource} privacyMode={privacyMode} tone="brand" />
                        </Section>
                    </div>
                )}

                {data.accountActivity.length > 1 && (
                    <div className={data.incomeBySource.length > 0 ? "lg:col-span-6" : "lg:col-span-12"}>
                        <Section title="By account">
                            <AccountCards rows={data.accountActivity} privacyMode={privacyMode} />
                        </Section>
                    </div>
                )}
            </div>
        </div>
    );
}

function CategoryBars({
    rows,
    privacyMode,
    tone = "danger",
}: {
    rows: AnalyticsResult["spendingByCategory"];
    privacyMode: boolean;
    tone?: "danger" | "brand";
}) {
    if (rows.length === 0) return <EmptyNote>Nothing in this period.</EmptyNote>;

    const max = Math.max(...rows.map((r) => r.amount), 1);
    const fill = tone === "brand" ? "bg-brand" : "bg-danger";

    return (
        <Card>
            <div className="space-y-3">
                {rows.map((r) => (
                    <div key={r.categoryId}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-semibold text-ink">{r.name}</span>
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
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-chip">
                            <div
                                className={`h-full rounded-full ${r.color ? "" : fill}`}
                                style={{
                                    width: `${Math.max(2, (r.amount / max) * 100)}%`,
                                    backgroundColor: r.color ?? undefined,
                                }}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                            {r.txCount} time{r.txCount === 1 ? "" : "s"}
                            {r.share !== null && !privacyMode ? ` · ${r.share.toFixed(0)}%` : ""}
                        </p>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function TopPurchases({
    rows,
    privacyMode,
}: {
    rows: AnalyticsResult["topExpenses"];
    privacyMode: boolean;
}) {
    if (rows.length === 0) return <EmptyNote>No purchases this period.</EmptyNote>;

    return (
        <Card className="divide-y divide-line !p-0">
            {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{r.description}</p>
                        <p className="truncate text-xs text-muted">
                            {r.categoryName} · {formatDate(r.date)}
                        </p>
                    </div>
                    <p className={`shrink-0 font-bold tabular-nums text-danger ${privacyMode ? "blur-[6px] select-none opacity-70" : ""}`}>
                        −{formatCurrency(r.amount, privacyMode)}
                    </p>
                </div>
            ))}
        </Card>
    );
}

function MonthlyChart({ data, privacyMode }: { data: AnalyticsResult; privacyMode: boolean }) {
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
                    <Bar dataKey="income" name="income" fill={BRAND} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="expenses" name="expenses" fill={DANGER} radius={[3, 3, 0, 0]} isAnimationActive={false} />
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

function NetWorthChart({ data, privacyMode }: { data: AnalyticsResult; privacyMode: boolean }) {
    const [selectedAccountId, setSelectedAccountId] = useState("all");

    if (data.netWorth.series.length < 2) {
        return (
            <EmptyNote>
                Not enough history yet. Current net worth:{" "}
                <span className="font-semibold text-ink">{formatCurrency(data.netWorth.current, privacyMode)}</span>.
            </EmptyNote>
        );
    }

    const selected = data.netWorthByAccount.find((a) => a.accountId === selectedAccountId);
    const series = selected ? selected.series : data.netWorth.series;
    const current = selected ? selected.current : data.netWorth.current;

    return (
        <Card>
            {data.netWorthByAccount.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                        type="button"
                        onClick={() => setSelectedAccountId("all")}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 select-none ${
                            selectedAccountId === "all" ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                        }`}
                    >
                        All
                    </button>
                    {data.netWorthByAccount.map((a) => (
                        <button
                            key={a.accountId}
                            type="button"
                            onClick={() => setSelectedAccountId(a.accountId)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 select-none ${
                                selectedAccountId === a.accountId
                                    ? "bg-ink text-paper"
                                    : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {a.name}
                        </button>
                    ))}
                </div>
            )}
            <p
                className={`mb-2 text-lg font-extrabold tabular-nums ${privacyMode ? "blur-[6px] select-none opacity-70" : ""} ${
                    current >= 0 ? "text-ink" : "text-danger"
                }`}
            >
                {formatCurrency(current, privacyMode)}
            </p>
            <ResponsiveContainer width="100%" height={180}>
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
        </Card>
    );
}

function AccountCards({
    rows,
    privacyMode,
}: {
    rows: AnalyticsResult["accountActivity"];
    privacyMode: boolean;
}) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((r) => (
                <Card key={r.accountId}>
                    <p className="truncate text-sm font-bold text-ink">{r.name}</p>
                    <p
                        className={`mt-1 text-lg font-extrabold tabular-nums ${
                            r.net >= 0 ? "text-brand" : "text-danger"
                        } ${privacyMode ? "blur-[6px] select-none opacity-70" : ""}`}
                    >
                        {r.net >= 0 ? "+" : ""}
                        {formatCurrency(r.net, privacyMode)}
                    </p>
                    <p className={`mt-1 text-xs text-muted ${privacyMode ? "blur-[5px] select-none opacity-70" : ""}`}>
                        in {formatCurrency(r.income + r.transfersIn, privacyMode)} · out{" "}
                        {formatCurrency(r.expenses + r.transfersOut, privacyMode)}
                    </p>
                </Card>
            ))}
        </div>
    );
}
