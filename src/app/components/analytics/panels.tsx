"use client";

import { useState } from "react";
import {
    Bar,
    Cell,
    ComposedChart,
    Line,
    LineChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { AnalyticsResult } from "@/lib/analytics";
import { AMOUNT_MASK, formatCurrency, formatDate } from "../../shared";
import { Card, EmptyNote, Sparkline } from "./primitives";

type A = AnalyticsResult;

const AXIS = "#918c7c";
const BRAND = "#1f7a54";
const DANGER = "#a8402f";
const NEUTRAL = "#c9c3b2";
const FALLBACK_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

function colorFor(name: string, explicit: string | null, i: number): string {
    return explicit ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

const money = (v: unknown, privacyMode: boolean) =>
    typeof v === "number" ? formatCurrency(v, privacyMode) : String(v);

// ---------- income vs expenses per month ----------

export function MonthlyBars({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.monthlySeries.length < 2) return <EmptyNote>Not enough months of history yet.</EmptyNote>;
    return (
        <Card>
            <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data.monthlySeries}>
                    <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                        stroke={AXIS}
                        tick={{ fontSize: 11 }}
                        width={64}
                        tickFormatter={(v: number) => (privacyMode ? AMOUNT_MASK : String(Math.round(v)))}
                    />
                    <Tooltip formatter={(v) => money(v, privacyMode)} isAnimationActive={false} />
                    <ReferenceLine y={0} stroke={AXIS} />
                    <Bar dataKey="income" name="Income" fill={BRAND} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="expenses" name="Expenses" fill={DANGER} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Line
                        type="monotone"
                        dataKey="expensesMA3"
                        name="3-month avg"
                        stroke="#6b6455"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted">Dashed line: 3-month average of expenses.</p>
        </Card>
    );
}

// ---------- net worth ----------

export function NetWorthChart({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

    if (data.netWorth.series.length < 2) {
        return (
            <EmptyNote>
                Not enough history for a trend yet. Current net worth:{" "}
                <span className="font-semibold text-ink">{formatCurrency(data.netWorth.current, privacyMode)}</span>.
            </EmptyNote>
        );
    }

    const selectedAccount = data.netWorthByAccount.find((a) => a.accountId === selectedAccountId);
    const activeSeries = selectedAccount ? selectedAccount.series : data.netWorth.series;
    const activeCurrent = selectedAccount ? selectedAccount.current : data.netWorth.current;

    return (
        <Card>
            {data.netWorthByAccount.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    <button
                        type="button"
                        onClick={() => setSelectedAccountId("all")}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 select-none ${
                            selectedAccountId === "all" ? "bg-ink text-white" : "bg-chip text-muted hover:bg-chip-hover"
                        }`}
                    >
                        All accounts
                    </button>
                    {data.netWorthByAccount.map((a) => (
                        <button
                            key={a.accountId}
                            type="button"
                            onClick={() => setSelectedAccountId(a.accountId)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 select-none ${
                                selectedAccountId === a.accountId ? "bg-ink text-white" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {a.name}
                        </button>
                    ))}
                </div>
            )}
            <ResponsiveContainer width="100%" height={240}>
                <LineChart data={activeSeries}>
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
                        width={70}
                        tickFormatter={(v: number) => (privacyMode ? AMOUNT_MASK : String(Math.round(v)))}
                    />
                    <Tooltip
                        formatter={(v) => money(v, privacyMode)}
                        labelFormatter={(l) => (typeof l === "string" ? formatDate(l) : String(l))}
                        isAnimationActive={false}
                    />
                    {!selectedAccount && data.netWorth.allTimeHigh > 0 && (
                        <ReferenceLine
                            y={data.netWorth.allTimeHigh}
                            stroke={NEUTRAL}
                            strokeDasharray="4 4"
                            label={{ value: "peak", fontSize: 10, fill: AXIS, position: "insideTopRight" }}
                        />
                    )}
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
            {selectedAccount && (
                <p className="mt-2 text-xs text-muted">
                    {selectedAccount.name} balance: <span className="font-semibold text-ink">{formatCurrency(activeCurrent, privacyMode)}</span>
                </p>
            )}
        </Card>
    );
}

// ---------- spending pace vs a typical period ----------

export function PaceChart({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.paceCurve.length < 2) {
        return <EmptyNote>Pace needs a few complete months to compare against.</EmptyNote>;
    }
    return (
        <Card>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.paceCurve}>
                    <XAxis
                        dataKey="day"
                        stroke={AXIS}
                        tick={{ fontSize: 11 }}
                        minTickGap={20}
                        tickFormatter={(d: number) => `d${d}`}
                    />
                    <YAxis
                        stroke={AXIS}
                        tick={{ fontSize: 11 }}
                        width={64}
                        tickFormatter={(v: number) => (privacyMode ? AMOUNT_MASK : String(Math.round(v)))}
                    />
                    <Tooltip
                        formatter={(v) => money(v, privacyMode)}
                        labelFormatter={(l) => `Day ${l}`}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="baseline"
                        name="Typical"
                        stroke={NEUTRAL}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="current"
                        name="This period"
                        stroke={DANGER}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted">
                Cumulative spend day by day. Dashed is your {data.period.baselineMonths.length}-month typical shape —
                above it means you&apos;re running hot.
            </p>
        </Card>
    );
}

// ---------- category breakdown ----------

export function CategoryPanel({
    title,
    rows,
    privacyMode,
    tone,
    baselineMonthCount,
}: {
    title: string;
    rows: A["spendingByCategory"];
    privacyMode: boolean;
    tone: "brand" | "danger";
    baselineMonthCount: number;
}) {
    if (rows.length === 0) return <EmptyNote>No {title.toLowerCase()} in this period.</EmptyNote>;

    const MAX_SLICES = 8;
    const top = rows.slice(0, MAX_SLICES - 1);
    const restTotal = rows.slice(MAX_SLICES - 1).reduce((s, r) => s + r.amount, 0);
    const slices = restTotal > 0 ? [...top, { categoryId: "other", name: "Other", amount: restTotal, color: NEUTRAL }] : top;

    return (
        <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="shrink-0 sm:w-40">
                    <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                            <Pie
                                data={slices}
                                dataKey="amount"
                                nameKey="name"
                                innerRadius={38}
                                outerRadius={70}
                                stroke="none"
                                isAnimationActive={false}
                            >
                                {slices.map((s, i) => (
                                    <Cell key={s.categoryId} fill={colorFor(s.name, s.color ?? null, i)} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v) => money(v, privacyMode)} isAnimationActive={false} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                    {rows.map((r, i) => (
                        <div key={r.categoryId} className="flex items-center gap-2 text-sm">
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: colorFor(r.name, r.color, i) }}
                            />
                            <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                            {r.sparkline.length > 1 && (
                                <span className="hidden w-16 shrink-0 sm:block">
                                    <Sparkline values={r.sparkline} tone={tone} width={64} height={16} />
                                </span>
                            )}
                            <span className="shrink-0 text-xs text-muted">{r.txCount}×</span>
                            <span className="w-24 shrink-0 text-right font-medium text-ink">
                                {formatCurrency(r.amount, privacyMode)}
                            </span>
                            <span className="w-12 shrink-0 text-right text-xs text-muted">
                                {r.share !== null && !privacyMode ? `${r.share.toFixed(0)}%` : ""}
                            </span>
                            <span className="w-14 shrink-0 text-right text-xs font-bold">
                                {r.vsBaselinePct === null ? (
                                    <span className="text-muted">—</span>
                                ) : (
                                    <span className={r.vsBaselinePct > 0 ? "text-danger" : "text-brand"}>
                                        {r.vsBaselinePct > 0 ? "+" : ""}
                                        {privacyMode ? AMOUNT_MASK : `${r.vsBaselinePct.toFixed(0)}%`}
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                    {baselineMonthCount > 0 && (
                        <p className="pt-1 text-xs text-muted">
                            Last column compares against your {baselineMonthCount}-month average.
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}

// ---------- biggest movers ----------

export function MoversPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.movers.length === 0) {
        return <EmptyNote>Nothing moved much against your usual pattern.</EmptyNote>;
    }
    const maxAbs = Math.max(...data.movers.map((m) => Math.abs(m.absChange)));
    return (
        <Card>
            <div className="space-y-2.5">
                {data.movers.map((m) => {
                    const up = m.absChange > 0;
                    const pct = maxAbs === 0 ? 0 : (Math.abs(m.absChange) / maxAbs) * 100;
                    return (
                        <div key={m.categoryId}>
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-ink">{m.name}</span>
                                <span className={`shrink-0 font-bold ${up ? "text-danger" : "text-brand"}`}>
                                    {up ? "+" : "−"}
                                    {formatCurrency(Math.abs(m.absChange), privacyMode)}
                                </span>
                            </div>
                            {/* Diverging bar: increases grow right of centre, decreases left. */}
                            <div className="mt-1 flex h-1.5 items-center">
                                <div className="flex h-full w-1/2 justify-end">
                                    {!up && <div className="h-full rounded-l-full bg-brand" style={{ width: `${pct}%` }} />}
                                </div>
                                <div className="h-full w-px bg-line" />
                                <div className="flex h-full w-1/2">
                                    {up && <div className="h-full rounded-r-full bg-danger" style={{ width: `${pct}%` }} />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// ---------- daily spending heatmap ----------

export function HeatmapPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const days = data.dailyTotals;
    if (days.length === 0) return <EmptyNote>No days to show.</EmptyNote>;

    const max = Math.max(...days.map((d) => d.amount));
    const dow = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday-first
    const firstDow = dow(days[0].date);

    // sqrt rather than linear: most days are small, so this spreads the low end out
    // instead of washing everything pale except a couple of outliers.
    function shade(amount: number): { bg: string; dark: boolean } {
        if (amount <= 0) return { bg: "var(--color-chip)", dark: false };
        const t = max === 0 ? 0 : amount / max;
        const alpha = 0.15 + Math.sqrt(t) * 0.85;
        return { bg: `rgba(168, 64, 47, ${alpha.toFixed(3)})`, dark: alpha > 0.62 };
    }

    const legend = (
        <span className="flex items-center gap-1">
            less
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <span key={t} className="h-3 w-3 rounded-[2px]" style={{ background: shade(t * max).bg }} />
            ))}
            more
        </span>
    );

    // A month-sized range reads far better as an actual calendar than as a strip of
    // week-columns, so switch layout by span rather than forcing one shape on both.
    if (days.length <= 62) {
        const cells: ({ date: string; amount: number } | null)[] = [
            ...Array.from({ length: firstDow }, () => null),
            ...days,
        ];
        return (
            <Card>
                <div className="grid grid-cols-7 gap-1.5">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                        <div key={d} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted">
                            {d}
                        </div>
                    ))}
                    {cells.map((c, i) => {
                        if (c === null) return <div key={`pad-${i}`} />;
                        const { bg, dark } = shade(c.amount);
                        return (
                            <div
                                key={c.date}
                                title={`${formatDate(c.date)} · ${formatCurrency(c.amount, privacyMode)}`}
                                className="flex aspect-square flex-col items-center justify-center rounded-lg text-[10px] leading-tight"
                                style={{ background: bg }}
                            >
                                <span className={dark ? "font-bold text-white" : "font-bold text-ink/70"}>
                                    {Number(c.date.slice(8, 10))}
                                </span>
                                {c.amount > 0 && !privacyMode && (
                                    <span className={dark ? "text-white/85" : "text-ink/55"}>
                                        {c.amount >= 100 ? Math.round(c.amount) : c.amount.toFixed(0)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 flex items-center justify-end text-xs text-muted">{legend}</div>
            </Card>
        );
    }

    // Long ranges: compact week-per-column strip.
    const cells: ({ date: string; amount: number } | null)[] = [
        ...Array.from({ length: firstDow }, () => null),
        ...days,
    ];
    return (
        <Card>
            <div className="overflow-x-auto">
                <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
                    {cells.map((c, i) =>
                        c === null ? (
                            <div key={`pad-${i}`} className="h-3 w-3" />
                        ) : (
                            <div
                                key={c.date}
                                title={`${formatDate(c.date)} · ${formatCurrency(c.amount, privacyMode)}`}
                                className="h-3 w-3 rounded-[2px]"
                                style={{ background: shade(c.amount).bg }}
                            />
                        )
                    )}
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>
                    {formatDate(days[0].date)} → {formatDate(days[days.length - 1].date)}
                </span>
                {legend}
            </div>
        </Card>
    );
}

// ---------- weekday pattern ----------

export function WeekdayPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const max = Math.max(...data.byWeekday.map((w) => w.total), 0);
    if (max === 0) return <EmptyNote>No spending recorded in this period.</EmptyNote>;
    return (
        <Card>
            <div className="space-y-2">
                {data.byWeekday.map((w) => (
                    <div key={w.name} className="flex items-center gap-3 text-sm">
                        <span className="w-8 shrink-0 text-xs font-semibold text-muted">{w.name}</span>
                        <div className="h-3 min-w-0 flex-1 rounded-full bg-chip">
                            <div
                                className="h-full rounded-full bg-danger/70"
                                style={{ width: `${(w.total / max) * 100}%` }}
                            />
                        </div>
                        <span className="w-24 shrink-0 text-right text-ink">{formatCurrency(w.total, privacyMode)}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ---------- frequency: small purchases add up ----------

export function FrequencyPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.frequency.length === 0) return <EmptyNote>No purchases in this period.</EmptyNote>;
    const maxCount = Math.max(...data.frequency.map((f) => f.txCount));
    return (
        <Card>
            <div className="space-y-2.5">
                {data.frequency.map((f, i) => (
                    <div key={f.categoryId} className="flex items-center gap-3 text-sm">
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: colorFor(f.name, f.color, i) }}
                        />
                        <span className="w-24 shrink-0 truncate text-ink">{f.name}</span>
                        <div className="h-3 min-w-0 flex-1 rounded-full bg-chip">
                            <div
                                className="h-full rounded-full bg-ink/25"
                                style={{ width: `${(f.txCount / maxCount) * 100}%` }}
                            />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs font-bold text-ink">{f.txCount}×</span>
                        <span className="w-20 shrink-0 text-right text-xs text-muted">
                            avg {formatCurrency(f.avgTx, privacyMode)}
                        </span>
                        <span className="w-24 shrink-0 text-right font-medium text-ink">
                            {formatCurrency(f.amount, privacyMode)}
                        </span>
                    </div>
                ))}
            </div>
            <p className="mt-3 text-xs text-muted">
                How often, not just how much — many small purchases can outweigh a few big ones.
            </p>
        </Card>
    );
}

// ---------- recurring charges ----------

export function RecurringPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.recurring.length === 0) {
        return (
            <EmptyNote>
                No recurring charges detected. Detection needs at least three charges with the same description at a
                steady interval
                {data.blankDescriptions > 0 ? ", and blank descriptions are invisible to it" : ""}.
            </EmptyNote>
        );
    }
    const STATUS: Record<string, { label: string; cls: string }> = {
        upcoming: { label: "upcoming", cls: "bg-chip text-muted" },
        due: { label: "due now", cls: "bg-brand-soft text-brand" },
        overdue: { label: "overdue", cls: "bg-danger-soft text-danger" },
        ended: { label: "ended", cls: "bg-chip text-muted" },
    };
    return (
        <Card className="p-0">
            <div className="divide-y divide-line">
                {data.recurring.map((r) => (
                    <div key={r.key} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{r.description}</p>
                            <p className="truncate text-xs text-muted">
                                {r.categoryName} · {r.intervalLabel} · {r.occurrences}× · next ≈ {formatDate(r.nextExpected)}
                            </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[r.status].cls}`}>
                            {STATUS[r.status].label}
                        </span>
                        <span className="w-24 shrink-0 text-right text-sm font-bold text-ink">
                            {formatCurrency(r.avgAmount, privacyMode)}
                            {r.amountVaries && <span className="ml-1 text-xs font-normal text-muted">~</span>}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ---------- anomalies & duplicates ----------

export function AnomaliesPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.anomalies.length === 0 && data.duplicates.length === 0) {
        return <EmptyNote>Nothing unusual spotted in this period.</EmptyNote>;
    }
    return (
        <div className="space-y-3">
            {data.duplicates.length > 0 && (
                <Card className="p-0">
                    <div className="divide-y divide-line">
                        {data.duplicates.map((d) => (
                            <div key={d.key} className="flex items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-ink">
                                        {d.count}× {d.description}
                                    </p>
                                    <p className="text-xs text-muted">
                                        Same amount, same day ({formatDate(d.date)}), same account — possible double entry
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-bold text-danger">
                                    {formatCurrency(d.amount, privacyMode)}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            {data.anomalies.length > 0 && (
                <Card className="p-0">
                    <div className="divide-y divide-line">
                        {data.anomalies.map((a) => (
                            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-ink">{a.description}</p>
                                    <p className="truncate text-xs text-muted">
                                        {a.categoryName} · {formatDate(a.date)} · {a.timesTypical.toFixed(1)}× the usual{" "}
                                        {formatCurrency(a.categoryMedian, privacyMode)}
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-bold text-danger">
                                    {formatCurrency(a.amount, privacyMode)}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

// ---------- accounts ----------

export function AccountsPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.accountActivity.length === 0) return <EmptyNote>No accounts yet.</EmptyNote>;
    return (
        <>
            {/* Six columns don't fit a phone, so small screens get stacked rows instead of
                a table that silently clips its last three columns. */}
            <Card className="p-0 lg:hidden">
                <div className="divide-y divide-line">
                    {data.accountActivity.map((a) => (
                        <div key={a.accountId} className="px-4 py-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate font-semibold text-ink">{a.name}</span>
                                <span className={`shrink-0 font-bold ${a.balance >= 0 ? "text-ink" : "text-danger"}`}>
                                    {formatCurrency(a.balance, privacyMode)}
                                </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                                <span className="text-muted">
                                    in <span className="font-semibold text-brand">{formatCurrency(a.income + a.transfersIn, privacyMode)}</span>
                                </span>
                                <span className="text-muted">
                                    out <span className="font-semibold text-danger">{formatCurrency(a.expenses + a.transfersOut, privacyMode)}</span>
                                </span>
                                <span className="text-muted">
                                    net{" "}
                                    <span className={`font-semibold ${a.net >= 0 ? "text-brand" : "text-danger"}`}>
                                        {formatCurrency(a.net, privacyMode)}
                                    </span>
                                </span>
                                {a.share !== null && !privacyMode && (
                                    <span className="text-muted">{a.share.toFixed(0)}% of net worth</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-muted">
                        <th className="p-3">Account</th>
                        <th className="p-3 text-right">Balance</th>
                        <th className="p-3 text-right">Share</th>
                        <th className="p-3 text-right">In</th>
                        <th className="p-3 text-right">Out</th>
                        <th className="p-3 text-right">Net</th>
                    </tr>
                </thead>
                <tbody>
                    {data.accountActivity.map((a) => (
                        <tr key={a.accountId} className="border-b border-line last:border-0">
                            <td className="p-3 font-medium text-ink">{a.name}</td>
                            <td className={`p-3 text-right font-bold ${a.balance >= 0 ? "text-ink" : "text-danger"}`}>
                                {formatCurrency(a.balance, privacyMode)}
                            </td>
                            <td className="p-3 text-right text-muted">
                                {a.share !== null && !privacyMode ? `${a.share.toFixed(0)}%` : "—"}
                            </td>
                            <td className="p-3 text-right text-brand">
                                {formatCurrency(a.income + a.transfersIn, privacyMode)}
                            </td>
                            <td className="p-3 text-right text-danger">
                                {formatCurrency(a.expenses + a.transfersOut, privacyMode)}
                            </td>
                            <td className={`p-3 text-right font-bold ${a.net >= 0 ? "text-brand" : "text-danger"}`}>
                                {formatCurrency(a.net, privacyMode)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </Card>
        </>
    );
}

// ---------- top expenses ----------

export function TopExpensesPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.topExpenses.length === 0) return <EmptyNote>No expenses in this period.</EmptyNote>;
    return (
        <Card className="p-0">
            <div className="divide-y divide-line">
                {data.topExpenses.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                                {tx.description || tx.categoryName}
                            </p>
                            <p className="truncate text-xs text-muted">
                                {tx.categoryName} · {tx.accountName} · {formatDate(tx.date)}
                            </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-danger">
                            {formatCurrency(tx.amount, privacyMode)}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}
