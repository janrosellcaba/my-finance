// Focused analytics: period totals, category split, top purchases, monthly trend,
// and all-time net worth. Dates are "YYYY-MM-DD" and compared lexicographically.

import { applyTransactionToBalances, round2 } from "./balances";

export type TxType = "income" | "expense" | "transfer";

export type AnalyticsTx = {
    id: string;
    date: string;
    description: string;
    type: TxType;
    amount: number;
    accountId: string;
    destinationId: string;
    createdAt?: string;
};

export type AnalyticsAccount = { id: string; name: string; initialBalance: number };
export type AnalyticsCategory = {
    id: string;
    name: string;
    type: "income" | "expense";
    color: string | null;
    icon: string | null;
};

export type PeriodMode = "month" | "3m" | "year" | "all";

const DAY_MS = 86_400_000;

function toUTC(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
    return fromUTC(toUTC(iso) + n * DAY_MS);
}

function diffDays(from: string, to: string): number {
    return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

function monthKey(iso: string): string {
    return iso.slice(0, 7);
}

function daysInMonth(year: number, month1: number): number {
    return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function monthStart(key: string): string {
    return `${key}-01`;
}

function monthEnd(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${key}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

function shiftMonth(key: string, n: number): string {
    const [y, m] = key.split("-").map(Number);
    const total = y * 12 + (m - 1) + n;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
}

function shortMonthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}

function sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
}

function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return round2(((current - previous) / Math.abs(previous)) * 100);
}

export type ResolvedPeriod = {
    mode: PeriodMode;
    anchor: string | null;
    start: string;
    end: string;
    label: string;
    isPartial: boolean;
    elapsedDays: number;
    totalDays: number;
    prevStart: string | null;
    prevEnd: string | null;
};

export function resolvePeriod(
    mode: PeriodMode,
    anchor: string | null,
    today: string,
    earliest: string
): ResolvedPeriod {
    const currentMonth = monthKey(today);
    let start: string;
    let end: string;
    let label: string;
    let anchorOut: string | null = null;

    if (mode === "month") {
        const key = anchor && /^\d{4}-\d{2}$/.test(anchor) ? anchor : currentMonth;
        anchorOut = key;
        start = monthStart(key);
        end = monthEnd(key);
        label = monthLabel(key);
    } else if (mode === "year") {
        const y = anchor && /^\d{4}$/.test(anchor) ? anchor : today.slice(0, 4);
        anchorOut = y;
        start = `${y}-01-01`;
        end = `${y}-12-31`;
        label = y;
    } else if (mode === "3m") {
        const firstKey = shiftMonth(currentMonth, -2);
        start = monthStart(firstKey);
        end = monthEnd(currentMonth);
        label = `${shortMonthLabel(firstKey)} – ${shortMonthLabel(currentMonth)}`;
    } else {
        start = earliest;
        end = today > earliest ? today : earliest;
        label = "All time";
    }

    const cappedEnd = end > today ? today : end;
    const isPartial = end > today && start <= today;
    const elapsedDays = start > today ? 0 : diffDays(start, cappedEnd) + 1;
    const totalDays = diffDays(start, end) + 1;

    let prevStart: string | null = null;
    let prevEnd: string | null = null;
    if (mode === "month") {
        const prevKey = shiftMonth(anchorOut!, -1);
        prevStart = monthStart(prevKey);
        prevEnd = monthEnd(prevKey);
    } else if (mode === "year") {
        const py = String(Number(anchorOut!) - 1);
        prevStart = `${py}-01-01`;
        prevEnd = `${py}-12-31`;
    } else if (mode === "3m") {
        const prevLastKey = shiftMonth(monthKey(start), -1);
        const prevFirstKey = shiftMonth(prevLastKey, -2);
        prevStart = monthStart(prevFirstKey);
        prevEnd = monthEnd(prevLastKey);
    }

    return {
        mode,
        anchor: anchorOut,
        start,
        end,
        label,
        isPartial,
        elapsedDays,
        totalDays,
        prevStart,
        prevEnd,
    };
}

export type PeriodTotals = {
    income: number;
    expenses: number;
    netSavings: number;
    savingsRate: number | null;
    txCount: number;
    expenseCount: number;
    avgExpense: number;
};

function totalsFor(txs: AnalyticsTx[]): PeriodTotals {
    let income = 0;
    let expenses = 0;
    let expenseCount = 0;
    for (const tx of txs) {
        if (tx.type === "income") income += tx.amount;
        else if (tx.type === "expense") {
            expenses += tx.amount;
            expenseCount++;
        }
    }
    const netSavings = income - expenses;
    return {
        income: round2(income),
        expenses: round2(expenses),
        netSavings: round2(netSavings),
        savingsRate: income === 0 ? null : round2((netSavings / income) * 100),
        txCount: txs.length,
        expenseCount,
        avgExpense: expenseCount === 0 ? 0 : round2(expenses / expenseCount),
    };
}

function inRange(txs: AnalyticsTx[], start: string, end: string): AnalyticsTx[] {
    return txs.filter((tx) => tx.date >= start && tx.date <= end);
}

export type Delta = {
    current: number;
    previous: number;
    change: number;
    changePct: number | null;
};

export type CategoryRow = {
    categoryId: string;
    name: string;
    color: string | null;
    icon: string | null;
    amount: number;
    share: number | null;
    txCount: number;
    prevAmount: number;
    changePct: number | null;
};

export type MonthlyPoint = {
    month: string;
    label: string;
    income: number;
    expenses: number;
    netSavings: number;
};

export type HealthPart = {
    key: string;
    label: string;
    score: number;
    weight: number;
    note: string;
};

export type Health = {
    score: number | null;
    label: string;
    parts: HealthPart[];
};

function money0(n: number): string {
    return `€${Math.round(Math.abs(n)).toLocaleString("es-ES")}`;
}

export type NetWorthPoint = { date: string; netWorth: number };

export type AnalyticsResult = ReturnType<typeof buildAnalytics>;

export function buildAnalytics(input: {
    txs: AnalyticsTx[];
    accounts: AnalyticsAccount[];
    categories: AnalyticsCategory[];
    mode: PeriodMode;
    anchor: string | null;
    today: string;
    accountId?: string | null;
}) {
    const { accounts, categories, mode, anchor, today } = input;
    const txs = [...input.txs].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        const aCreated = a.createdAt ?? "";
        const bCreated = b.createdAt ?? "";
        if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;
        return a.id < b.id ? -1 : 1;
    });

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const initialTotal = sum(accounts.map((a) => a.initialBalance));

    const earliest = txs.length > 0 ? txs[0].date : today;
    const availableMonths = Array.from(new Set(txs.map((tx) => monthKey(tx.date)))).sort().reverse();
    const availableYears = Array.from(new Set(txs.map((tx) => tx.date.slice(0, 4)))).sort().reverse();
    if (!availableMonths.includes(monthKey(today))) availableMonths.unshift(monthKey(today));
    if (!availableYears.includes(today.slice(0, 4))) availableYears.unshift(today.slice(0, 4));

    const period = resolvePeriod(mode, anchor, today, earliest);
    const focusAccountId =
        input.accountId && accountById.has(input.accountId) ? input.accountId : null;

    function scopedToFocus(list: AnalyticsTx[]): AnalyticsTx[] {
        if (!focusAccountId) return list;
        return list.filter(
            (tx) => (tx.type === "income" || tx.type === "expense") && tx.accountId === focusAccountId
        );
    }

    const allPeriodTx = inRange(txs, period.start, period.end);
    const periodTx = scopedToFocus(allPeriodTx);
    const summary = totalsFor(periodTx);
    const fullSummary = focusAccountId ? totalsFor(allPeriodTx) : summary;

    let prevTotals: PeriodTotals | null = null;
    let fullPrevTotals: PeriodTotals | null = null;
    let prevIsTruncated = false;
    if (period.prevStart && period.prevEnd) {
        let pEnd = period.prevEnd;
        if (period.isPartial && period.elapsedDays > 0) {
            const truncated = addDays(period.prevStart, period.elapsedDays - 1);
            if (truncated < pEnd) {
                pEnd = truncated;
                prevIsTruncated = true;
            }
        }
        const prevRange = inRange(txs, period.prevStart, pEnd);
        prevTotals = totalsFor(scopedToFocus(prevRange));
        fullPrevTotals = totalsFor(prevRange);
    }

    function delta(current: number, previous: number | undefined): Delta | null {
        if (previous === undefined) return null;
        return {
            current: round2(current),
            previous: round2(previous),
            change: round2(current - previous),
            changePct: pctChange(current, previous),
        };
    }

    function categoryRows(type: "income" | "expense"): CategoryRow[] {
        const cur = new Map<string, { amount: number; count: number }>();
        for (const tx of periodTx) {
            if (tx.type !== type) continue;
            const slot = cur.get(tx.destinationId) ?? { amount: 0, count: 0 };
            slot.amount += tx.amount;
            slot.count++;
            cur.set(tx.destinationId, slot);
        }
        const prevMap = new Map<string, number>();
        if (period.prevStart && period.prevEnd) {
            let pEnd = period.prevEnd;
            if (prevIsTruncated) pEnd = addDays(period.prevStart, period.elapsedDays - 1);
            for (const tx of inRange(txs, period.prevStart, pEnd)) {
                if (tx.type !== type) continue;
                if (focusAccountId && tx.accountId !== focusAccountId) continue;
                prevMap.set(tx.destinationId, (prevMap.get(tx.destinationId) ?? 0) + tx.amount);
            }
        }
        const total = sum([...cur.values()].map((s) => s.amount));
        return [...cur.entries()]
            .map(([id, slot]) => {
                const cat = categoryById.get(id);
                const prevAmount = round2(prevMap.get(id) ?? 0);
                return {
                    categoryId: id,
                    name: cat?.name ?? "Unknown",
                    color: cat?.color ?? null,
                    icon: cat?.icon ?? null,
                    amount: round2(slot.amount),
                    share: total === 0 ? null : round2((slot.amount / total) * 100),
                    txCount: slot.count,
                    prevAmount,
                    changePct: prevTotals ? pctChange(slot.amount, prevAmount) : null,
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }

    const spendingByCategory = categoryRows("expense");
    const incomeBySource = categoryRows("income");

    const topExpenses = periodTx
        .filter((tx) => tx.type === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8)
        .map((tx) => {
            const catName = categoryById.get(tx.destinationId)?.name ?? "Unknown";
            return {
                id: tx.id,
                date: tx.date,
                description: tx.description.trim() || catName,
                categoryId: tx.destinationId,
                categoryName: catName,
                accountName: accountById.get(tx.accountId)?.name ?? "Unknown",
                amount: round2(tx.amount),
            };
        });

    // Monthly bars: months that overlap the selected period, padded so a single
    // month still shows context. The chart is full width (~2× the old slot), so
    // we prepend another full window of months to keep each bar the same width.
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    const chartMonthlyMap = new Map<string, { income: number; expenses: number }>();
    for (const tx of txs) {
        const key = monthKey(tx.date);
        const slot = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
        if (tx.type === "income") slot.income += tx.amount;
        else if (tx.type === "expense") slot.expenses += tx.amount;
        monthlyMap.set(key, slot);

        if (
            tx.type === "income" || tx.type === "expense"
        ) {
            if (!focusAccountId || tx.accountId === focusAccountId) {
                const chartSlot = chartMonthlyMap.get(key) ?? { income: 0, expenses: 0 };
                if (tx.type === "income") chartSlot.income += tx.amount;
                else chartSlot.expenses += tx.amount;
                chartMonthlyMap.set(key, chartSlot);
            }
        }
    }

    const periodFirstMonth = monthKey(period.start);
    const periodLastMonth = monthKey(period.end > today ? today : period.end);
    let chartFirst = periodFirstMonth;
    if (mode === "month") chartFirst = shiftMonth(periodFirstMonth, -5);
    let monthsShown = 0;
    for (let k = chartFirst; k <= periodLastMonth; k = shiftMonth(k, 1)) monthsShown++;
    chartFirst = shiftMonth(chartFirst, -monthsShown);
    const earliestMonth = monthKey(earliest);
    if (chartFirst < earliestMonth) chartFirst = earliestMonth;
    const monthlySeries: MonthlyPoint[] = [];
    for (let k = chartFirst; k <= periodLastMonth; k = shiftMonth(k, 1)) {
        const slot = chartMonthlyMap.get(k) ?? { income: 0, expenses: 0 };
        monthlySeries.push({
            month: k,
            label: shortMonthLabel(k),
            income: round2(slot.income),
            expenses: round2(slot.expenses),
            netSavings: round2(slot.income - slot.expenses),
        });
    }

    const dailyDelta = new Map<string, number>();
    const txsByDate = new Map<string, AnalyticsTx[]>();
    for (const tx of txs) {
        if (tx.type !== "transfer") {
            dailyDelta.set(tx.date, (dailyDelta.get(tx.date) ?? 0) + (tx.type === "income" ? tx.amount : -tx.amount));
        }
        const list = txsByDate.get(tx.date);
        if (list) list.push(tx);
        else txsByDate.set(tx.date, [tx]);
    }

    const nwStart = earliest;
    const nwEnd = today > earliest ? today : earliest;

    const perAccountRun: Record<string, number> = {};
    for (const acc of accounts) perAccountRun[acc.id] = acc.initialBalance;

    let nwRun = initialTotal;
    let t = toUTC(nwStart);
    const nwEndMs = toUTC(nwEnd);
    const chartDays = Math.round((nwEndMs - t) / DAY_MS) + 1;
    const step = Math.max(1, Math.ceil(Math.max(1, chartDays) / 200));

    const netWorthSeries: NetWorthPoint[] = [];
    const perAccountSeries = new Map<string, NetWorthPoint[]>();
    for (const acc of accounts) perAccountSeries.set(acc.id, []);

    const periodStartMs = toUTC(period.start);
    const balanceAtPeriodStart: Record<string, number> = {};
    for (const acc of accounts) balanceAtPeriodStart[acc.id] = acc.initialBalance;

    let chartIndex = 0;
    while (t <= nwEndMs) {
        const d = fromUTC(t);
        if (t === periodStartMs) {
            for (const acc of accounts) balanceAtPeriodStart[acc.id] = perAccountRun[acc.id];
        }
        nwRun += dailyDelta.get(d) ?? 0;
        for (const tx of txsByDate.get(d) ?? []) applyTransactionToBalances(perAccountRun, tx);
        if (chartIndex % step === 0 || t === nwEndMs) {
            netWorthSeries.push({ date: d, netWorth: round2(nwRun) });
            for (const acc of accounts) {
                perAccountSeries.get(acc.id)!.push({ date: d, netWorth: round2(perAccountRun[acc.id]) });
            }
        }
        chartIndex++;
        t += DAY_MS;
    }

    const currentNetWorth = round2(nwRun);
    const netWorthByAccount = accounts.map((acc) => {
        const series = perAccountSeries.get(acc.id)!;
        const current = series.length > 0 ? series[series.length - 1].netWorth : round2(acc.initialBalance);
        const prevAmount = round2(balanceAtPeriodStart[acc.id] ?? acc.initialBalance);
        return {
            accountId: acc.id,
            name: acc.name,
            current,
            prevAmount,
            changePct: pctChange(current, prevAmount),
            series,
        };
    });

    const accountActivity = accounts.map((acc) => {
        let income = 0;
        let expenses = 0;
        let transfersIn = 0;
        let transfersOut = 0;
        for (const tx of allPeriodTx) {
            if (tx.type === "income" && tx.accountId === acc.id) income += tx.amount;
            else if (tx.type === "expense" && tx.accountId === acc.id) expenses += tx.amount;
            else if (tx.type === "transfer") {
                if (tx.accountId === acc.id) transfersOut += tx.amount;
                if (tx.destinationId === acc.id) transfersIn += tx.amount;
            }
        }
        return {
            accountId: acc.id,
            name: acc.name,
            income: round2(income),
            expenses: round2(expenses),
            transfersIn: round2(transfersIn),
            transfersOut: round2(transfersOut),
            net: round2(income - expenses + transfersIn - transfersOut),
            balance: round2(perAccountRun[acc.id] ?? acc.initialBalance),
        };
    });

    const dailySpend = period.elapsedDays > 0 ? round2(summary.expenses / period.elapsedDays) : 0;
    const fullDailySpend =
        period.elapsedDays > 0 ? round2(fullSummary.expenses / period.elapsedDays) : 0;

    const currentMonthKey = monthKey(today);
    const completeMonths: { month: string; expenses: number; netWorthEnd: number }[] = [];
    {
        let nw = initialTotal;
        const firstMonth = monthKey(earliest);
        const lastMonth = currentMonthKey;
        for (let k = firstMonth; k <= lastMonth; k = shiftMonth(k, 1)) {
            const slot = monthlyMap.get(k) ?? { income: 0, expenses: 0 };
            nw += slot.income - slot.expenses;
            if (k < currentMonthKey) {
                completeMonths.push({ month: k, expenses: round2(slot.expenses), netWorthEnd: round2(nw) });
            }
        }
    }
    const recentComplete = completeMonths.slice(-6);

    const healthParts: HealthPart[] = [];
    {
        const rate = fullSummary.savingsRate;
        if (rate !== null) {
            const s = Math.max(0, Math.min(100, ((rate + 10) / 50) * 100));
            healthParts.push({
                key: "savings",
                label: "Savings rate",
                score: Math.round(s),
                weight: 3,
                note: `${rate.toFixed(0)}% of income kept`,
            });
        }
        if (fullPrevTotals && fullPrevTotals.expenses > 0) {
            const change = fullSummary.expenses - fullPrevTotals.expenses;
            const pct = (change / fullPrevTotals.expenses) * 100;
            const s = Math.max(0, Math.min(100, 55 - pct));
            healthParts.push({
                key: "spending",
                label: "Spending",
                score: Math.round(s),
                weight: 2,
                note:
                    change <= 0
                        ? `${money0(-change)} less than last period`
                        : `${money0(change)} more than last period`,
            });
        }
        if (recentComplete.length >= 2) {
            const first = recentComplete[0].netWorthEnd;
            const last = recentComplete[recentComplete.length - 1].netWorthEnd;
            const grew = last - first;
            const s =
                grew >= 0
                    ? Math.min(100, 55 + (grew / Math.max(1, Math.abs(first))) * 200)
                    : Math.max(0, 55 + (grew / Math.max(1, Math.abs(first))) * 200);
            healthParts.push({
                key: "trend",
                label: "Net worth",
                score: Math.round(Math.max(0, Math.min(100, s))),
                weight: 3,
                note:
                    grew >= 0
                        ? `up ${money0(grew)} over ${recentComplete.length} months`
                        : `down ${money0(grew)} over ${recentComplete.length} months`,
            });
        }
        const burnMonths = recentComplete.slice(-3);
        const monthlyBurn = burnMonths.length
            ? sum(burnMonths.map((m) => m.expenses)) / burnMonths.length
            : fullDailySpend > 0
              ? fullDailySpend * 30
              : 0;
        if (monthlyBurn > 0 && currentNetWorth > 0) {
            const cover = currentNetWorth / monthlyBurn;
            healthParts.push({
                key: "cushion",
                label: "Cushion",
                score: Math.round(Math.max(0, Math.min(100, (cover / 3) * 100))),
                weight: 2,
                note: `${cover.toFixed(1)} months of spending covered`,
            });
        }
    }
    const healthWeight = sum(healthParts.map((p) => p.weight));
    const healthScore =
        healthWeight > 0 ? Math.round(sum(healthParts.map((p) => p.score * p.weight)) / healthWeight) : null;
    const healthLabel =
        healthScore === null
            ? "Not enough yet"
            : healthScore >= 75
              ? "Looking strong"
              : healthScore >= 55
                ? "Tracking well"
                : healthScore >= 35
                  ? "Worth a look"
                  : "Needs a look";

    return {
        period: {
            mode: period.mode,
            anchor: period.anchor,
            start: period.start,
            end: period.end,
            label: period.label,
            isPartial: period.isPartial,
            elapsedDays: period.elapsedDays,
            totalDays: period.totalDays,
        },
        availableMonths,
        availableYears,
        monthOptions: availableMonths.map((k) => ({ key: k, label: monthLabel(k) })),
        summary,
        comparison: {
            previous: prevTotals,
            previousTruncated: prevIsTruncated,
            expensesDelta: delta(summary.expenses, prevTotals?.expenses),
            incomeDelta: delta(summary.income, prevTotals?.income),
            savingsDelta: delta(summary.netSavings, prevTotals?.netSavings),
        },
        dailySpend,
        spendingByCategory,
        incomeBySource,
        topExpenses,
        monthlySeries,
        netWorth: {
            current: currentNetWorth,
            series: netWorthSeries,
        },
        netWorthByAccount,
        accountActivity,
        health: { score: healthScore, label: healthLabel, parts: healthParts },
    };
}
