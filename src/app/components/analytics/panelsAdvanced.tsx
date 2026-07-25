"use client";

import { ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsResult } from "@/lib/analytics";
import { AMOUNT_MASK, formatCurrency, formatDate } from "../../shared";
import { Card, EmptyNote } from "./primitives";

type A = AnalyticsResult;

const AXIS = "#918c7c";
const BRAND = "#1f7a54";
const DANGER = "#a8402f";
const NEUTRAL = "#c9c3b2";

const money = (v: unknown, privacyMode: boolean) =>
    typeof v === "number" ? formatCurrency(v, privacyMode) : String(v);

// ---------- net-worth trajectory + milestone ETA ----------

export function TrajectoryPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const trajectory = data.trajectory;
    if (!trajectory) {
        return <EmptyNote>Needs three complete months before a trend can be projected.</EmptyNote>;
    }
    const lineColor = trajectory.direction === "down" ? DANGER : BRAND;

    return (
        <Card>
            <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={trajectory.points}>
                    <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                        stroke={AXIS}
                        tick={{ fontSize: 11 }}
                        width={64}
                        tickFormatter={(v: number) => (privacyMode ? AMOUNT_MASK : String(Math.round(v)))}
                    />
                    <Tooltip formatter={(v) => money(v, privacyMode)} isAnimationActive={false} />
                    <Line
                        type="monotone"
                        dataKey="actual"
                        name="Net worth"
                        stroke={lineColor}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="central"
                        name="Projected"
                        stroke={lineColor}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="low"
                        name="Cautious"
                        stroke={NEUTRAL}
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="high"
                        name="Optimistic"
                        stroke={NEUTRAL}
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>

            {trajectory.milestones.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {trajectory.milestones.map((m) => (
                        <div key={m.target} className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-ink">{money(m.target, privacyMode)}</span>
                            <span className="text-muted">{m.etaLabel}</span>
                            <span className="text-xs text-muted">
                                {m.monthsAway < 1 ? "<1 mo" : `~${m.monthsAway.toFixed(0)} mo`}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <p className="mt-2 text-xs text-muted">{trajectory.basis}</p>
        </Card>
    );
}

// ---------- payday-cycle analysis ----------

export function PaydayPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const payday = data.payday;
    if (!payday) {
        return (
            <EmptyNote>
                No clear pay rhythm detected yet — this needs three months with a consistent main income date.
            </EmptyNote>
        );
    }
    const maxAvg = Math.max(...payday.buckets.map((b) => b.avgSpend), 1);

    return (
        <Card>
            <p className="text-sm text-ink">
                Paid around the <span className="font-bold">{payday.dayOfMonth}{ordinalSuffix(payday.dayOfMonth)}</span> ·{" "}
                {payday.consistency}% consistent · {payday.cyclesAnalysed} cycles analysed
            </p>

            <div className="mt-3 space-y-2">
                {payday.buckets.map((b) => (
                    <div key={b.label} className="flex items-center gap-3 text-xs">
                        <span className="w-20 shrink-0 text-muted">{b.label}</span>
                        <div className="h-2 min-w-0 flex-1 rounded-full bg-chip">
                            <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${Math.max(4, (b.avgSpend / maxAvg) * 100)}%` }}
                            />
                        </div>
                        <span className="w-16 shrink-0 text-right font-semibold text-ink">
                            {money(b.avgSpend, privacyMode)}
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">
                    {payday.daysSincePayday} days in · {payday.daysUntilNextPayday} to go
                </span>
                <span className="font-semibold text-ink">{money(payday.spentSincePayday, privacyMode)}</span>
            </div>
            {payday.typicalSpentByThisPoint !== null && (
                <p className="mt-1 text-xs text-muted">
                    Usually around {money(payday.typicalSpentByThisPoint, privacyMode)} by this point in the cycle.
                </p>
            )}
        </Card>
    );
}

function ordinalSuffix(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

// ---------- dormant categories ----------

export function DormantPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.dormant.length === 0) {
        return <EmptyNote>Nothing you used to buy regularly has gone quiet.</EmptyNote>;
    }
    return (
        <Card>
            <div className="space-y-2.5">
                {data.dormant.map((d) => (
                    <div key={d.categoryId} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{d.name}</p>
                            <p className="text-xs text-muted">
                                Last seen {formatDate(d.lastDate)} · {d.monthsSince} month(s) ago
                            </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">{money(d.typicalMonthly, privacyMode)}/mo usual</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ---------- first-time purchases ----------

export function FirstTimePanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    if (data.firstTime.length === 0) {
        return <EmptyNote>Nothing new to your history this period.</EmptyNote>;
    }
    return (
        <Card>
            <div className="space-y-2.5">
                {data.firstTime.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{f.description || f.categoryName}</p>
                            <p className="flex items-center gap-1.5 text-xs text-muted">
                                {f.categoryName}
                                {f.isNewCategory && (
                                    <span className="rounded-full bg-chip px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                                        new category
                                    </span>
                                )}
                            </p>
                        </div>
                        <span className="shrink-0 font-semibold text-danger">{money(f.amount, privacyMode)}</span>
                    </div>
                ))}
            </div>
            <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
                {data.firstTime.length} item(s), {money(data.firstTimeTotal, privacyMode)} total.
            </p>
        </Card>
    );
}

// ---------- transaction-size distribution ----------

export function SizeDistributionPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const sd = data.sizeDistribution;
    if (!sd) {
        return <EmptyNote>Needs at least eight expenses in the period.</EmptyNote>;
    }
    const maxSpend = Math.max(...sd.buckets.map((b) => b.total), 1);

    return (
        <Card>
            <div className="space-y-2">
                {sd.buckets.map((b) => (
                    <div key={b.label} className="flex items-center gap-3 text-xs">
                        <span className="w-20 shrink-0 text-muted">{b.label}</span>
                        <div className="h-2 min-w-0 flex-1 rounded-full bg-chip">
                            <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${Math.max(b.total > 0 ? 4 : 0, (b.total / maxSpend) * 100)}%` }}
                            />
                        </div>
                        <span className="w-16 shrink-0 text-right font-semibold text-ink">{money(b.total, privacyMode)}</span>
                        <span className="w-10 shrink-0 text-right text-muted">{b.count}×</span>
                    </div>
                ))}
            </div>
            <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
                Median {money(sd.medianTx, privacyMode)} · top 10% are {money(sd.p90Tx, privacyMode)}+ and make up{" "}
                {privacyMode ? AMOUNT_MASK : `${sd.top10PctShare.toFixed(0)}%`} of spend.
            </p>
        </Card>
    );
}

// ---------- year over year ----------

export function YoYPanel({ data, privacyMode }: { data: A; privacyMode: boolean }) {
    const yoy = data.yoy;
    if (!yoy) {
        return <EmptyNote>Year-on-year comparison unlocks once you have twelve months of history.</EmptyNote>;
    }
    return (
        <Card>
            <div className="space-y-2">
                <Row label="Expenses" now={data.summary.expenses} then={yoy.expenses} privacyMode={privacyMode} goodWhenUp={false} />
                <Row label="Income" now={data.summary.income} then={yoy.income} privacyMode={privacyMode} goodWhenUp />
            </div>

            {yoy.categories.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {yoy.categories.map((c) => (
                        <div key={c.categoryId} className="flex items-center justify-between text-xs">
                            <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                            <span className="shrink-0 text-muted">
                                {money(c.now, privacyMode)} vs {money(c.then, privacyMode)}
                            </span>
                            <span
                                className={`w-14 shrink-0 text-right font-bold ${
                                    c.changePct === null ? "text-muted" : c.changePct > 0 ? "text-danger" : "text-brand"
                                }`}
                            >
                                {c.changePct === null
                                    ? "—"
                                    : privacyMode
                                      ? AMOUNT_MASK
                                      : `${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(0)}%`}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <p className="mt-2 text-xs text-muted">
                Compared against {yoy.label}
                {yoy.truncated ? " (same number of days elapsed)" : ""}
                {yoy.partialHistory ? " — your records don't cover that whole window" : ""}.
            </p>
        </Card>
    );
}

function Row({
    label,
    now,
    then,
    privacyMode,
    goodWhenUp,
}: {
    label: string;
    now: number;
    then: number;
    privacyMode: boolean;
    goodWhenUp: boolean;
}) {
    const changePct = then === 0 ? null : ((now - then) / Math.abs(then)) * 100;
    const up = now > then;
    const positive = goodWhenUp ? up : !up;
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{label}</span>
            <span className="font-semibold text-ink">
                {money(now, privacyMode)} <span className="text-xs font-normal text-muted">vs {money(then, privacyMode)}</span>
            </span>
            {changePct !== null && (
                <span className={`text-xs font-bold ${positive ? "text-brand" : "text-danger"}`}>
                    {privacyMode ? AMOUNT_MASK : `${changePct > 0 ? "+" : ""}${changePct.toFixed(0)}%`}
                </span>
            )}
        </div>
    );
}
