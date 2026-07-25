"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AnalyticsResult } from "@/lib/analytics";
import { formatCurrency } from "../../shared";
import { NetWorthChart, TopExpensesPanel } from "./panels";
import { Card, EmptyNote, Section, StatTile } from "./primitives";

type Tab = "overview" | "categories" | "accounts" | "trends";
const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "categories", label: "Categories" },
    { key: "accounts", label: "Accounts" },
    { key: "trends", label: "Trends" },
];

const FALLBACK_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
const OTHER_COLOR = "#918c7c";

function colorFor(name: string, explicit: string | null, i: number): string {
    return explicit ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

export function SimpleDashboard({ data, privacyMode }: { data: AnalyticsResult; privacyMode: boolean }) {
    const [tab, setTab] = useState<Tab>("overview");
    const { summary } = data;
    const money = (n: number) => formatCurrency(n, privacyMode);

    const summaryCards = (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Income" value={money(summary.income)} tone="brand" privacyMode={privacyMode} />
            <StatTile label="Expenses" value={money(summary.expenses)} tone="danger" privacyMode={privacyMode} />
            <StatTile
                label="Net Savings"
                value={money(summary.netSavings)}
                tone={summary.netSavings >= 0 ? "brand" : "danger"}
                privacyMode={privacyMode}
            />
            <StatTile
                label="Savings Rate"
                value={summary.savingsRate === null ? "—" : privacyMode ? "****" : `${summary.savingsRate.toFixed(1)}%`}
                tone="ink"
                privacyMode={privacyMode}
                info="The share of your income you kept this period — net savings divided by income."
            />
        </div>
    );

    const spendingCats = (
        <SimpleCategoryBreakdown
            title="Spending by category"
            rows={data.spendingByCategory}
            privacyMode={privacyMode}
            info="How your spending splits across categories this period."
        />
    );
    const incomeCats = (
        <SimpleCategoryBreakdown
            title="Income by source"
            rows={data.incomeBySource}
            privacyMode={privacyMode}
            info="How your income splits across sources this period."
        />
    );

    return (
        <>
            {/* ---------- mobile: one section at a time ---------- */}
            <div className="space-y-6 lg:hidden">
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-chip p-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`rounded-lg py-2 text-xs font-bold transition-colors duration-150 select-none ${
                                tab === t.key ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "overview" && (
                    <>
                        {summaryCards}
                        <Section
                            title="Top 15 largest expenses"
                            info="Your single biggest individual transactions this period, ranked by amount — useful for spotting one-off purchases rather than everyday spending."
                        >
                            <TopExpensesPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </>
                )}

                {tab === "categories" && (
                    <>
                        {spendingCats}
                        {incomeCats}
                    </>
                )}

                {tab === "accounts" && (
                    <Section
                        title="Account activity"
                        info="Money in and out of each account this period. 'Net' is income minus expenses (and transfers) for that account."
                    >
                        <SimpleAccountsTable rows={data.accountActivity} privacyMode={privacyMode} />
                    </Section>
                )}

                {tab === "trends" && (
                    <Section
                        title="Net worth over time"
                        info="The combined balance across all your accounts, tracked day by day. The dashed line marks your all-time high."
                    >
                        <NetWorthChart data={data} privacyMode={privacyMode} />
                    </Section>
                )}
            </div>

            {/* ---------- desktop: everything at once ---------- */}
            <div className="hidden lg:grid lg:grid-cols-6 lg:gap-6">
                <div className="col-span-6">{summaryCards}</div>

                <div className="col-span-4">
                    <Section
                        title="Net worth over time"
                        info="The combined balance across all your accounts, tracked day by day. The dashed line marks your all-time high."
                    >
                        <NetWorthChart data={data} privacyMode={privacyMode} />
                    </Section>
                </div>
                <div className="col-span-2">
                    <Section
                        title="Top 15 largest expenses"
                        info="Your single biggest individual transactions this period, ranked by amount — useful for spotting one-off purchases rather than everyday spending."
                    >
                        <div className="max-h-[320px] overflow-y-auto pr-1">
                            <TopExpensesPanel data={data} privacyMode={privacyMode} />
                        </div>
                    </Section>
                </div>

                <div className="col-span-3">{spendingCats}</div>
                <div className="col-span-3">{incomeCats}</div>

                <div className="col-span-6">
                    <Section
                        title="Account activity"
                        info="Money in and out of each account this period. 'Net' is income minus expenses (and transfers) for that account."
                    >
                        <SimpleAccountsTable rows={data.accountActivity} privacyMode={privacyMode} />
                    </Section>
                </div>
            </div>
        </>
    );
}

function SimpleCategoryBreakdown({
    title,
    rows,
    privacyMode,
    info,
}: {
    title: string;
    rows: AnalyticsResult["spendingByCategory"];
    privacyMode: boolean;
    info?: string;
}) {
    if (rows.length === 0) {
        return (
            <Section title={title} info={info}>
                <EmptyNote>No data for this period.</EmptyNote>
            </Section>
        );
    }

    const MAX_SLICES = 8;
    const top = rows.slice(0, MAX_SLICES - 1);
    const restTotal = rows.slice(MAX_SLICES - 1).reduce((s, r) => s + r.amount, 0);
    const slices =
        restTotal > 0
            ? [...top, { categoryId: "other", name: "Other", amount: restTotal, color: OTHER_COLOR }]
            : top;

    return (
        <Section title={title} info={info}>
            <Card>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie data={slices} dataKey="amount" nameKey="name" outerRadius={80} stroke="none" isAnimationActive={false}>
                            {slices.map((s, i) => (
                                <Cell key={s.categoryId} fill={colorFor(s.name, s.color ?? null, i)} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v) => (typeof v === "number" ? formatCurrency(v, privacyMode) : v)} isAnimationActive={false} />
                    </PieChart>
                </ResponsiveContainer>

                <div className="mt-3 space-y-1.5">
                    {rows.map((r, i) => (
                        <div key={r.categoryId} className="flex items-center justify-between text-sm">
                            <span className="flex min-w-0 items-center gap-2 text-ink">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(r.name, r.color, i) }} />
                                <span className="truncate">{r.name}</span>
                            </span>
                            <span className="shrink-0 text-muted">
                                {formatCurrency(r.amount, privacyMode)}
                                {r.share !== null && !privacyMode ? ` · ${r.share.toFixed(1)}%` : ""}
                            </span>
                        </div>
                    ))}
                </div>
            </Card>
        </Section>
    );
}

function SimpleAccountsTable({
    rows,
    privacyMode,
}: {
    rows: AnalyticsResult["accountActivity"];
    privacyMode: boolean;
}) {
    if (rows.length === 0) return <EmptyNote>No accounts yet.</EmptyNote>;

    return (
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper shadow-sm">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-muted">
                        <th className="p-3">Account</th>
                        <th className="p-3 text-right">Income</th>
                        <th className="p-3 text-right">Expenses</th>
                        <th className="p-3 text-right">Net</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.accountId} className="border-b border-line last:border-0">
                            <td className="p-3 font-medium text-ink">{r.name}</td>
                            <td className="p-3 text-right text-brand">{formatCurrency(r.income + r.transfersIn, privacyMode)}</td>
                            <td className="p-3 text-right text-danger">{formatCurrency(r.expenses + r.transfersOut, privacyMode)}</td>
                            <td className={`p-3 text-right font-bold ${r.net >= 0 ? "text-brand" : "text-danger"}`}>
                                {formatCurrency(r.net, privacyMode)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
