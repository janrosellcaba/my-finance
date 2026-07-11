"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, INPUT_CLS } from "./shared";

const CATEGORY_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
const OTHER_COLOR = "#918c7c";
const MAX_PIE_SLICES = 8;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function colorForCategory(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

type CategoryRow = { categoryId: string; name: string; amount: number; percentOfTotal: number | null };
type AccountActivityRow = {
    accountId: string;
    name: string;
    income: number;
    expenses: number;
    transfersIn: number;
    transfersOut: number;
    net: number;
};
type TopExpenseRow = { id: string; date: string; categoryName: string; description: string; amount: number };
type NetWorthPoint = { date: string; netWorth: number };

type AnalyticsData = {
    availableYears: string[];
    summary: { income: number; expenses: number; netSavings: number; savingsRate: number | null };
    spendingByCategory: CategoryRow[];
    incomeBySource: CategoryRow[];
    topExpenses: TopExpenseRow[];
    accountActivity: AccountActivityRow[];
    netWorthOverTime: NetWorthPoint[];
};

export function AnalyticsView({ privacyMode }: { privacyMode: boolean }) {
    const router = useRouter();
    const [year, setYear] = useState("all");
    const [month, setMonth] = useState("all");
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const params = new URLSearchParams();
        if (year !== "all") {
            params.set("year", year);
            if (month !== "all") params.set("month", month);
        }
        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (res.status === 401) {
            router.refresh();
            return;
        }
        const json = (await res.json()) as { success: boolean } & Partial<AnalyticsData>;
        if (json.success) setData(json as AnalyticsData);
    }, [year, month, router]);

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, [fetchData]);

    function handleYearChange(next: string) {
        setYear(next);
        if (next === "all") setMonth("all");
    }

    if (loading || !data) {
        return <p className="px-5 pt-10 text-center text-muted">Loading your analytics…</p>;
    }

    return (
        <div className="space-y-6 px-5 pt-6">
            <h1 className="text-2xl font-extrabold text-ink">Analytics</h1>

            <div className="flex gap-2">
                <select value={year} onChange={(e) => handleYearChange(e.target.value)} className={INPUT_CLS}>
                    <option value="all">All Years</option>
                    {data.availableYears.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>
                <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    disabled={year === "all"}
                    className={`${INPUT_CLS} disabled:opacity-50`}
                >
                    <option value="all">All Months</option>
                    {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={String(i + 1)}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            <SummaryCards summary={data.summary} privacyMode={privacyMode} />

            <CategoryBreakdown title="Spending by Category" rows={data.spendingByCategory} privacyMode={privacyMode} />
            <CategoryBreakdown title="Income by Source" rows={data.incomeBySource} privacyMode={privacyMode} />

            <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Top 15 Largest Expenses</h2>
                <TopExpensesList items={data.topExpenses} privacyMode={privacyMode} />
            </div>

            <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Account Activity Summary</h2>
                <AccountActivityTable rows={data.accountActivity} privacyMode={privacyMode} />
            </div>

            <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Net Worth Over Time</h2>
                <NetWorthChart series={data.netWorthOverTime} privacyMode={privacyMode} />
            </div>
        </div>
    );
}

function SummaryCards({
    summary,
    privacyMode,
}: {
    summary: AnalyticsData["summary"];
    privacyMode: boolean;
}) {
    const savingsRateText =
        summary.savingsRate === null ? "—" : privacyMode ? "****" : `${(summary.savingsRate * 100).toFixed(1)}%`;

    return (
        <div className="grid grid-cols-2 gap-3">
            <StatCard label="Income" value={formatCurrency(summary.income, privacyMode)} tone="brand" />
            <StatCard label="Expenses" value={formatCurrency(summary.expenses, privacyMode)} tone="danger" />
            <StatCard
                label="Net Savings"
                value={formatCurrency(summary.netSavings, privacyMode)}
                tone={summary.netSavings >= 0 ? "brand" : "danger"}
            />
            <StatCard label="Savings Rate" value={savingsRateText} tone="ink" />
        </div>
    );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "brand" | "danger" | "ink" }) {
    const toneClass = tone === "brand" ? "text-brand" : tone === "danger" ? "text-danger" : "text-ink";
    return (
        <div className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
            <p className="truncate text-sm font-medium text-muted">{label}</p>
            <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
        </div>
    );
}

function CategoryBreakdown({
    title,
    rows,
    privacyMode,
}: {
    title: string;
    rows: CategoryRow[];
    privacyMode: boolean;
}) {
    if (rows.length === 0) {
        return (
            <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
                <p className="text-sm text-muted">No data for this period.</p>
            </div>
        );
    }

    const top = rows.slice(0, MAX_PIE_SLICES - 1);
    const restTotal = rows.slice(MAX_PIE_SLICES - 1).reduce((sum, r) => sum + r.amount, 0);
    const pieSlices =
        restTotal > 0
            ? [...top, { categoryId: "other", name: "Other", amount: restTotal, percentOfTotal: null }]
            : top;

    return (
        <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
            <div className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={pieSlices}
                            dataKey="amount"
                            nameKey="name"
                            outerRadius={80}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {pieSlices.map((slice) => (
                                <Cell
                                    key={slice.categoryId}
                                    fill={slice.name === "Other" ? OTHER_COLOR : colorForCategory(slice.name)}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => (typeof value === "number" ? formatCurrency(value, privacyMode) : value)}
                        />
                    </PieChart>
                </ResponsiveContainer>

                <div className="mt-3 space-y-1.5">
                    {rows.map((r) => (
                        <div key={r.categoryId} className="flex items-center justify-between text-sm">
                            <span className="flex min-w-0 items-center gap-2 text-ink">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ background: colorForCategory(r.name) }}
                                />
                                <span className="truncate">{r.name}</span>
                            </span>
                            <span className="shrink-0 text-muted">
                                {formatCurrency(r.amount, privacyMode)}
                                {r.percentOfTotal !== null && !privacyMode ? ` · ${r.percentOfTotal.toFixed(1)}%` : ""}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TopExpensesList({ items, privacyMode }: { items: TopExpenseRow[]; privacyMode: boolean }) {
    if (items.length === 0) {
        return <p className="text-sm text-muted">No expenses in this period.</p>;
    }

    return (
        <div className="space-y-2">
            {items.map((tx) => (
                <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-paper p-4 shadow-sm"
                >
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{tx.description || tx.categoryName}</p>
                        <p className="truncate text-xs text-muted">
                            {tx.categoryName} · {formatDate(tx.date)}
                        </p>
                    </div>
                    <p className="ml-3 shrink-0 text-lg font-bold text-danger">{formatCurrency(tx.amount, privacyMode)}</p>
                </div>
            ))}
        </div>
    );
}

function AccountActivityTable({ rows, privacyMode }: { rows: AccountActivityRow[]; privacyMode: boolean }) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted">No accounts yet.</p>;
    }

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
                            <td className="p-3 text-right text-danger">
                                {formatCurrency(r.expenses + r.transfersOut, privacyMode)}
                            </td>
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

function NetWorthChart({ series, privacyMode }: { series: NetWorthPoint[]; privacyMode: boolean }) {
    if (series.length < 2) {
        return <p className="text-sm text-muted">Not enough data yet.</p>;
    }

    return (
        <div className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series}>
                    <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => formatDate(d)}
                        stroke="#918c7c"
                        tick={{ fontSize: 11 }}
                        minTickGap={24}
                    />
                    <YAxis
                        tickFormatter={(v: number) => formatCurrency(v, privacyMode)}
                        stroke="#918c7c"
                        tick={{ fontSize: 11 }}
                        width={70}
                    />
                    <Tooltip
                        formatter={(value) => (typeof value === "number" ? formatCurrency(value, privacyMode) : value)}
                        labelFormatter={(label) => (typeof label === "string" ? formatDate(label) : label)}
                    />
                    <Line
                        type="monotone"
                        dataKey="netWorth"
                        stroke="#1f7a54"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
