// Pure analytics engine: everything is derived from the user's existing transaction
// history — no extra tables, no extra data entry. Deliberately free of DB and Next.js
// imports so the whole thing can be run standalone against real data to verify the maths.
//
// Dates are "YYYY-MM-DD" strings throughout and compared lexicographically, which is
// safe for that format and avoids timezone drift entirely (a Date-based implementation
// would shift days depending on where the Worker runs).

import { round2 } from "./balances";

export type TxType = "income" | "expense" | "transfer";

export type AnalyticsTx = {
    id: string;
    date: string;
    description: string;
    type: TxType;
    amount: number;
    accountId: string;
    destinationId: string;
};

export type AnalyticsAccount = { id: string; name: string; initialBalance: number };
export type AnalyticsCategory = { id: string; name: string; type: "income" | "expense"; color: string | null };

export type PeriodMode = "month" | "year" | "3m" | "12m" | "all";

// ---------- date helpers ----------

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

/** Shifts a "YYYY-MM" key by n months. */
function shiftMonth(key: string, n: number): string {
    const [y, m] = key.split("-").map(Number);
    const total = y * 12 + (m - 1) + n;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function weekdayIndex(iso: string): number {
    // 0 = Monday … 6 = Sunday (more natural for spending patterns than JS's Sunday-first).
    return (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
}

function shortMonthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}

// ---------- statistics helpers ----------

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation — robust to the outliers we're trying to find. */
function mad(values: number[], med: number): number {
    if (values.length === 0) return 0;
    return median(values.map((v) => Math.abs(v - med)));
}

function sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
}

/** Population standard deviation. */
function stdev(values: number[]): number {
    if (values.length === 0) return 0;
    const m = sum(values) / values.length;
    return Math.sqrt(sum(values.map((v) => (v - m) ** 2)) / values.length);
}

/** Shifts a "YYYY-MM-DD" by n months, clamping the day to the target month's length. */
function shiftIsoMonths(iso: string, n: number): string {
    const key = shiftMonth(iso.slice(0, 7), n);
    const [y, m] = key.split("-").map(Number);
    const day = Math.min(Number(iso.slice(8, 10)), daysInMonth(y, m));
    return `${key}-${String(day).padStart(2, "0")}`;
}

/** "mid September 2026" — vague on purpose; a projected date to the day would be a lie. */
function vagueDateLabel(iso: string): string {
    const d = Number(iso.slice(8, 10));
    const part = d <= 10 ? "early" : d <= 20 ? "mid" : "late";
    return `${part} ${monthLabel(iso.slice(0, 7))}`;
}

/** Percent change, null when the baseline is zero (an "infinite" rise is not useful). */
function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return round2(((current - previous) / Math.abs(previous)) * 100);
}

/** Whole-euro money for prose, where cents are noise. */
function money0(n: number): string {
    return `€${Math.round(n).toLocaleString("es-ES")}`;
}

/** Joins a list into readable prose: "a", "a and b", "a, b and c". */
function listPhrase(items: string[]): string {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function ordinal(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// ---------- period resolution ----------

export type ResolvedPeriod = {
    mode: PeriodMode;
    anchor: string | null;
    start: string;
    end: string;
    label: string;
    /** True when `end` extends past the latest data we could have (i.e. still in progress). */
    isPartial: boolean;
    elapsedDays: number;
    totalDays: number;
    /** Previous equivalent period, or null for "all". */
    prevStart: string | null;
    prevEnd: string | null;
    /** Complete month keys used as the rolling baseline (most recent last). */
    baselineMonths: string[];
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
    } else if (mode === "3m" || mode === "12m") {
        const span = mode === "3m" ? 3 : 12;
        const firstKey = shiftMonth(currentMonth, -(span - 1));
        start = monthStart(firstKey);
        end = monthEnd(currentMonth);
        label = `${shortMonthLabel(firstKey)} – ${shortMonthLabel(currentMonth)}`;
    } else {
        start = earliest;
        end = today > earliest ? today : earliest;
        label = `All time`;
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
    } else if (mode === "3m" || mode === "12m") {
        const span = mode === "3m" ? 3 : 12;
        const prevLastKey = shiftMonth(monthKey(start), -1);
        const prevFirstKey = shiftMonth(prevLastKey, -(span - 1));
        prevStart = monthStart(prevFirstKey);
        prevEnd = monthEnd(prevLastKey);
    }

    // Baseline = up to 3 *complete* months immediately before the period. Excluding the
    // in-progress month is what keeps "is this month unusual?" an honest question.
    const baselineAnchor = monthKey(start);
    const baselineMonths: string[] = [];
    for (let i = 3; i >= 1; i--) {
        const key = shiftMonth(baselineAnchor, -i);
        if (key >= monthKey(earliest) && key < currentMonth) baselineMonths.push(key);
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
        baselineMonths,
    };
}

// ---------- core aggregation ----------

export type PeriodTotals = {
    income: number;
    expenses: number;
    netSavings: number;
    savingsRate: number | null;
    txCount: number;
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
        avgExpense: expenseCount === 0 ? 0 : round2(expenses / expenseCount),
    };
}

function inRange(txs: AnalyticsTx[], start: string, end: string): AnalyticsTx[] {
    return txs.filter((tx) => tx.date >= start && tx.date <= end);
}

// ---------- result shape ----------

export type Delta = {
    current: number;
    previous: number;
    change: number;
    changePct: number | null;
};

export type CategoryStat = {
    categoryId: string;
    name: string;
    color: string | null;
    amount: number;
    share: number | null;
    txCount: number;
    avgTx: number;
    prevAmount: number;
    changePct: number | null;
    baselineAvg: number | null;
    vsBaselinePct: number | null;
    sparkline: number[];
};

export type MonthlyPoint = {
    month: string;
    label: string;
    income: number;
    expenses: number;
    netSavings: number;
    netWorthEnd: number;
};

export type Insight = {
    id: string;
    severity: "critical" | "warn" | "good" | "info";
    title: string;
    detail: string;
    /** A concrete, quantified next step, where one can honestly be derived. */
    advice?: string;
    score: number;
};

export type RecurringCharge = {
    key: string;
    description: string;
    categoryName: string;
    avgAmount: number;
    amountVaries: boolean;
    intervalLabel: string;
    intervalDays: number;
    occurrences: number;
    lastDate: string;
    nextExpected: string;
    status: "upcoming" | "due" | "overdue" | "ended";
};

export type Anomaly = {
    id: string;
    date: string;
    description: string;
    categoryName: string;
    amount: number;
    categoryMedian: number;
    timesTypical: number;
};

export type DuplicateGroup = {
    key: string;
    date: string;
    description: string;
    amount: number;
    count: number;
};

export type DormantCategory = {
    categoryId: string;
    name: string;
    lastDate: string;
    monthsSince: number;
    typicalMonthly: number;
    activeMonths: number;
    notSpentSince: number;
};

export type FirstTime = {
    id: string;
    date: string;
    description: string;
    categoryName: string;
    amount: number;
    isNewCategory: boolean;
};

export type SizeBucket = {
    label: string;
    count: number;
    total: number;
    countShare: number;
    spendShare: number;
};

export type SizeDistribution = {
    buckets: SizeBucket[];
    txCount: number;
    topDecileCount: number;
    medianTx: number;
    p90Tx: number;
    top10PctShare: number;
    under25Share: number;
    under25Count: number;
};

export type YoY = {
    label: string;
    start: string;
    end: string;
    truncated: boolean;
    partialHistory: boolean;
    income: number;
    expenses: number;
    netSavings: number;
    expensesDelta: Delta | null;
    incomeDelta: Delta | null;
    categories: { categoryId: string; name: string; now: number; then: number; changePct: number | null }[];
};

export type Milestone = {
    target: number;
    monthsAway: number;
    etaDate: string;
    etaLabel: string;
    optimisticMonths: number | null;
    cautiousMonths: number | null;
};

export type TrajectoryPoint = {
    label: string;
    actual: number | null;
    central: number | null;
    low: number | null;
    high: number | null;
};

export type Trajectory = {
    direction: "up" | "down" | "flat";
    monthlyNet: number;
    monthlyNetSd: number;
    monthsUsed: number;
    basis: string;
    points: TrajectoryPoint[];
    milestones: Milestone[];
};

export type PaydayBucket = { label: string; avgSpend: number; share: number };

export type PaydayProfile = {
    dayOfMonth: number;
    consistency: number;
    cyclesAnalysed: number;
    avgIncomePerCycle: number;
    avgSpendPerCycle: number;
    buckets: PaydayBucket[];
    frontloadPct: number;
    cycleStart: string;
    daysSincePayday: number;
    daysUntilNextPayday: number;
    spentSincePayday: number;
    typicalSpentByThisPoint: number | null;
};

export type AnalyticsResult = ReturnType<typeof buildAnalytics>;

export function buildAnalytics(input: {
    txs: AnalyticsTx[];
    accounts: AnalyticsAccount[];
    categories: AnalyticsCategory[];
    mode: PeriodMode;
    anchor: string | null;
    today: string;
}) {
    const { accounts, categories, mode, anchor, today } = input;
    const txs = [...input.txs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const initialTotal = sum(accounts.map((a) => a.initialBalance));

    const earliest = txs.length > 0 ? txs[0].date : today;
    const availableMonths = Array.from(new Set(txs.map((tx) => monthKey(tx.date)))).sort().reverse();
    const availableYears = Array.from(new Set(txs.map((tx) => tx.date.slice(0, 4)))).sort().reverse();

    const period = resolvePeriod(mode, anchor, today, earliest);
    const periodTx = inRange(txs, period.start, period.end);
    const summary = totalsFor(periodTx);

    // ---- comparison: previous equivalent period ----
    // When the current period is still in progress, the previous period is truncated to the
    // same number of elapsed days so the two are genuinely comparable.
    let prevTotals: PeriodTotals | null = null;
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
        prevTotals = totalsFor(inRange(txs, period.prevStart, pEnd));
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

    // ---- monthly series (drives bars, sparklines, baselines, streaks) ----
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    for (const tx of txs) {
        const key = monthKey(tx.date);
        const slot = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
        if (tx.type === "income") slot.income += tx.amount;
        else if (tx.type === "expense") slot.expenses += tx.amount;
        monthlyMap.set(key, slot);
    }

    const allMonthKeys: string[] = [];
    if (txs.length > 0) {
        let k = monthKey(earliest);
        const last = monthKey(today) > monthKey(txs[txs.length - 1].date) ? monthKey(today) : monthKey(txs[txs.length - 1].date);
        while (k <= last) {
            allMonthKeys.push(k);
            k = shiftMonth(k, 1);
        }
    }

    let runningNetWorth = initialTotal;
    const monthlySeriesFull: MonthlyPoint[] = allMonthKeys.map((key) => {
        const slot = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
        runningNetWorth += slot.income - slot.expenses;
        return {
            month: key,
            label: shortMonthLabel(key),
            income: round2(slot.income),
            expenses: round2(slot.expenses),
            netSavings: round2(slot.income - slot.expenses),
            netWorthEnd: round2(runningNetWorth),
        };
    });
    const currentKeyForMA = monthKey(today);
    const monthlySeriesWithMA = monthlySeriesFull.map((m, i) => {
        // The in-progress month is a partial figure; folding it in drags the average down
        // and makes the line lie about the trend.
        const usable = i >= 2 && monthlySeriesFull[i].month < currentKeyForMA;
        const win = usable ? monthlySeriesFull.slice(i - 2, i + 1) : [];
        return {
            ...m,
            expensesMA3: usable ? round2(sum(win.map((w) => w.expenses)) / 3) : null,
            incomeMA3: usable ? round2(sum(win.map((w) => w.income)) / 3) : null,
        };
    });
    const monthlySeries = monthlySeriesWithMA.slice(-24);

    const monthlyByKey = new Map(monthlySeriesFull.map((m) => [m.month, m]));
    const baselineExpenses = period.baselineMonths.length
        ? round2(sum(period.baselineMonths.map((k) => monthlyByKey.get(k)?.expenses ?? 0)) / period.baselineMonths.length)
        : null;
    const baselineIncome = period.baselineMonths.length
        ? round2(sum(period.baselineMonths.map((k) => monthlyByKey.get(k)?.income ?? 0)) / period.baselineMonths.length)
        : null;

    // ---- net worth series (gap-filled daily, downsampled for long ranges) ----
    const dailyDelta = new Map<string, number>();
    for (const tx of txs) {
        if (tx.type === "transfer") continue; // internal move: net worth unchanged
        const d = tx.type === "income" ? tx.amount : -tx.amount;
        dailyDelta.set(tx.date, (dailyDelta.get(tx.date) ?? 0) + d);
    }
    const nwStart = earliest;
    const nwEnd = today > earliest ? today : earliest;
    const nwPointsRaw: { date: string; netWorth: number }[] = [];
    let nwRun = initialTotal;
    for (let d = nwStart; d <= nwEnd; d = addDays(d, 1)) {
        nwRun += dailyDelta.get(d) ?? 0;
        nwPointsRaw.push({ date: d, netWorth: round2(nwRun) });
    }
    const currentNetWorth = nwPointsRaw.length > 0 ? nwPointsRaw[nwPointsRaw.length - 1].netWorth : round2(initialTotal);
    const step = Math.max(1, Math.ceil(nwPointsRaw.length / 400));
    const netWorthSeries = nwPointsRaw.filter((_, i) => i % step === 0 || i === nwPointsRaw.length - 1);

    const allTimeHigh = nwPointsRaw.reduce((mx, p) => (p.netWorth > mx ? p.netWorth : mx), currentNetWorth);
    const drawdown = round2(allTimeHigh - currentNetWorth);
    const drawdownPct = allTimeHigh > 0 ? round2((drawdown / allTimeHigh) * 100) : 0;

    // ---- daily totals for the heatmap (expenses only) ----
    const dailyExpense = new Map<string, number>();
    const dailyIncome = new Map<string, number>();
    for (const tx of txs) {
        if (tx.type === "expense") dailyExpense.set(tx.date, (dailyExpense.get(tx.date) ?? 0) + tx.amount);
        else if (tx.type === "income") dailyIncome.set(tx.date, (dailyIncome.get(tx.date) ?? 0) + tx.amount);
    }
    const heatmapStart = period.mode === "all" || period.mode === "12m" ? monthStart(shiftMonth(monthKey(today), -11)) : period.start;
    const heatmapEnd = period.end > today ? today : period.end;
    const dailyTotals: { date: string; amount: number }[] = [];
    if (heatmapStart <= heatmapEnd) {
        for (let d = heatmapStart; d <= heatmapEnd; d = addDays(d, 1)) {
            dailyTotals.push({ date: d, amount: round2(dailyExpense.get(d) ?? 0) });
        }
    }
    const noSpendDays = dailyTotals.filter((d) => d.amount === 0).length;

    // ---- pace: cumulative spend vs what a typical baseline period looked like ----
    const paceCurve: { day: number; current: number | null; baseline: number | null }[] = [];
    if (period.baselineMonths.length > 0 && (period.mode === "month" || period.isPartial)) {
        const maxDay = period.totalDays;
        const curCum: number[] = [];
        let acc = 0;
        for (let i = 0; i < maxDay; i++) {
            const d = addDays(period.start, i);
            if (d > today) break;
            acc += dailyExpense.get(d) ?? 0;
            curCum.push(round2(acc));
        }
        const baseCums: number[][] = period.baselineMonths.map((key) => {
            const bStart = monthStart(key);
            const bEnd = monthEnd(key);
            const out: number[] = [];
            let a = 0;
            for (let d = bStart, i = 0; d <= bEnd; d = addDays(d, 1), i++) {
                a += dailyExpense.get(d) ?? 0;
                out[i] = a;
            }
            return out;
        });
        for (let i = 0; i < maxDay; i++) {
            const baseVals = baseCums.map((c) => c[Math.min(i, c.length - 1)]).filter((v) => v !== undefined);
            paceCurve.push({
                day: i + 1,
                current: i < curCum.length ? curCum[i] : null,
                baseline: baseVals.length ? round2(sum(baseVals) / baseVals.length) : null,
            });
        }
    }

    // ---- projection for in-progress periods ----
    // For a month, the remainder is estimated from what the baseline months actually did on
    // those same days-of-month, not from a flat daily average. That matters a lot for income:
    // a salary landing on the 28th would otherwise be modelled as trickling in daily and a
    // month viewed on the 25th would look catastrophically unprofitable.
    let projection: {
        expenses: number;
        income: number;
        netSavings: number;
        basis: string;
        dayAware: boolean;
    } | null = null;
    if (period.isPartial && period.elapsedDays > 0 && period.elapsedDays < period.totalDays) {
        const remaining = period.totalDays - period.elapsedDays;
        const fromDay = period.elapsedDays + 1;

        /** Average of what baseline months spent/earned on days [fromDay..end-of-month]. */
        function baselineRemainder(map: Map<string, number>): number | null {
            if (period.baselineMonths.length === 0) return null;
            const totals = period.baselineMonths.map((key) => {
                const [y, m] = key.split("-").map(Number);
                const dim = daysInMonth(y, m);
                let acc = 0;
                for (let d = fromDay; d <= dim; d++) {
                    acc += map.get(`${key}-${String(d).padStart(2, "0")}`) ?? 0;
                }
                return acc;
            });
            return sum(totals) / totals.length;
        }

        const dayAware = period.mode === "month" && period.baselineMonths.length > 0;
        let remExp: number;
        let remInc: number;
        let basis: string;

        if (dayAware) {
            remExp = baselineRemainder(dailyExpense) ?? 0;
            remInc = baselineRemainder(dailyIncome) ?? 0;
            basis = `day ${period.elapsedDays} of ${period.totalDays}; remaining days estimated from what days ${fromDay}–${period.totalDays} normally bring in your last ${period.baselineMonths.length} months`;
        } else {
            const dailyExp = baselineExpenses !== null ? baselineExpenses / 30.44 : summary.expenses / period.elapsedDays;
            const dailyInc = baselineIncome !== null ? baselineIncome / 30.44 : summary.income / period.elapsedDays;
            remExp = dailyExp * remaining;
            remInc = dailyInc * remaining;
            basis = `${period.elapsedDays} of ${period.totalDays} days elapsed, remainder at your typical daily rate`;
        }

        const projExp = round2(summary.expenses + remExp);
        const projInc = round2(summary.income + remInc);
        projection = {
            expenses: projExp,
            income: projInc,
            netSavings: round2(projInc - projExp),
            basis,
            dayAware,
        };
    }

    // ---- per-category stats with 6-month sparklines ----
    const sparkMonths = allMonthKeys.slice(-6);
    function categoryStats(type: "income" | "expense"): CategoryStat[] {
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
                prevMap.set(tx.destinationId, (prevMap.get(tx.destinationId) ?? 0) + tx.amount);
            }
        }
        const baseMap = new Map<string, number[]>();
        for (const key of period.baselineMonths) {
            const monthTx = inRange(txs, monthStart(key), monthEnd(key));
            const per = new Map<string, number>();
            for (const tx of monthTx) {
                if (tx.type !== type) continue;
                per.set(tx.destinationId, (per.get(tx.destinationId) ?? 0) + tx.amount);
            }
            for (const [id] of cur) {
                const arr = baseMap.get(id) ?? [];
                arr.push(per.get(id) ?? 0);
                baseMap.set(id, arr);
            }
        }
        const sparkMap = new Map<string, number[]>();
        for (const key of sparkMonths) {
            const monthTx = inRange(txs, monthStart(key), monthEnd(key));
            const per = new Map<string, number>();
            for (const tx of monthTx) {
                if (tx.type !== type) continue;
                per.set(tx.destinationId, (per.get(tx.destinationId) ?? 0) + tx.amount);
            }
            for (const [id] of cur) {
                const arr = sparkMap.get(id) ?? [];
                arr.push(round2(per.get(id) ?? 0));
                sparkMap.set(id, arr);
            }
        }
        const total = type === "income" ? summary.income : summary.expenses;
        return Array.from(cur.entries())
            .map(([id, slot]) => {
                const cat = categoryById.get(id);
                const baseArr = baseMap.get(id) ?? [];
                const baselineAvg = baseArr.length ? round2(sum(baseArr) / baseArr.length) : null;
                const prevAmount = round2(prevMap.get(id) ?? 0);
                return {
                    categoryId: id,
                    name: cat?.name ?? "Uncategorised",
                    color: cat?.color ?? null,
                    amount: round2(slot.amount),
                    share: total === 0 ? null : round2((slot.amount / total) * 100),
                    txCount: slot.count,
                    avgTx: round2(slot.amount / slot.count),
                    prevAmount,
                    changePct: pctChange(slot.amount, prevAmount),
                    baselineAvg,
                    vsBaselinePct: baselineAvg === null ? null : pctChange(slot.amount, baselineAvg),
                    sparkline: sparkMap.get(id) ?? [],
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }

    const spendingByCategory = categoryStats("expense");
    const incomeBySource = categoryStats("income");

    // ---- biggest movers (materiality-filtered so tiny categories don't dominate) ----
    const materiality = Math.max(10, summary.expenses * 0.02);
    const movers = spendingByCategory
        .filter((c) => c.baselineAvg !== null && Math.abs(c.amount - (c.baselineAvg ?? 0)) >= materiality)
        .map((c) => ({ ...c, absChange: round2(c.amount - (c.baselineAvg ?? 0)) }))
        .sort((a, b) => Math.abs(b.absChange) - Math.abs(a.absChange))
        .slice(0, 8);

    // ---- recurring detection ----
    // Groups by normalised description, then requires a consistent gap between ≥3
    // occurrences. Deliberately strict: everyday variable purchases must NOT match.
    const recurring: RecurringCharge[] = [];
    {
        const groups = new Map<string, AnalyticsTx[]>();
        for (const tx of txs) {
            if (tx.type !== "expense") continue;
            const norm = tx.description.trim().toLowerCase().replace(/\s+/g, " ");
            if (norm.length < 2) continue; // blank descriptions carry no signal
            const arr = groups.get(norm) ?? [];
            arr.push(tx);
            groups.set(norm, arr);
        }
        for (const [key, list] of groups) {
            if (list.length < 3) continue;
            const dates = list.map((t) => t.date).sort();
            const gaps: number[] = [];
            for (let i = 1; i < dates.length; i++) gaps.push(diffDays(dates[i - 1], dates[i]));
            const medGap = median(gaps);
            const gapSpread = mad(gaps, medGap);
            let intervalLabel = "";
            if (medGap >= 6 && medGap <= 8) intervalLabel = "weekly";
            else if (medGap >= 13 && medGap <= 16) intervalLabel = "biweekly";
            else if (medGap >= 26 && medGap <= 35) intervalLabel = "monthly";
            else if (medGap >= 86 && medGap <= 96) intervalLabel = "quarterly";
            else if (medGap >= 355 && medGap <= 375) intervalLabel = "yearly";
            if (!intervalLabel) continue;
            // Gaps must actually be regular, not merely average out to a monthly-ish number.
            if (gapSpread > Math.max(3, medGap * 0.25)) continue;

            const amounts = list.map((t) => t.amount);
            const medAmt = median(amounts);
            const amtSpread = medAmt === 0 ? 0 : mad(amounts, medAmt) / medAmt;
            // Long intervals inferred from only three points are weak evidence — a restaurant
            // visited three times a few months apart is not a quarterly subscription. Demand
            // either a steady amount or a fourth occurrence.
            if (medGap > 40 && list.length < 4 && amtSpread > 0.15) continue;

            const lastDate = dates[dates.length - 1];
            const nextExpected = addDays(lastDate, Math.round(medGap));
            const overdueBy = diffDays(nextExpected, today);
            // Nothing for well over two cycles means it stopped, not that it's late.
            const hasEnded = diffDays(lastDate, today) > medGap * 2.5;
            recurring.push({
                key,
                description: list[list.length - 1].description,
                categoryName: categoryById.get(list[list.length - 1].destinationId)?.name ?? "Uncategorised",
                avgAmount: round2(medAmt),
                amountVaries: amtSpread > 0.15,
                intervalLabel,
                intervalDays: Math.round(medGap),
                occurrences: list.length,
                lastDate,
                nextExpected,
                status: hasEnded ? "ended" : overdueBy > 7 ? "overdue" : overdueBy >= 0 ? "due" : "upcoming",
            });
        }
        recurring.sort((a, b) => b.avgAmount - a.avgAmount);
    }
    const activeRecurring = recurring.filter((r) => r.status !== "ended");
    // Only steady-amount, still-active charges count as a predictable monthly floor.
    const fixedMonthlyEstimate = round2(
        sum(
            activeRecurring
                .filter((r) => !r.amountVaries)
                .map((r) => (r.avgAmount * 30.44) / r.intervalDays)
        )
    );

    // ---- anomalies: unusually large for their own category ----
    // A ratio alone is not enough. When a category's typical purchase is €1.99 of snacks,
    // an ordinary €12 meal is "6× typical" without being remotely noteworthy — so a
    // transaction must also be materially large in absolute terms. The percentage term is
    // capped so that very long periods (all-time) don't push the floor absurdly high.
    const anomalyFloor = Math.max(25, Math.min(summary.expenses * 0.05, 150));

    // ---- suspected duplicates (same day, amount, description and account) ----
    // Computed before anomalies so a double entry isn't also reported twice as an outlier.
    const duplicates: DuplicateGroup[] = [];
    const duplicateTxIds = new Set<string>();
    {
        const seen = new Map<string, AnalyticsTx[]>();
        for (const tx of periodTx) {
            const norm = tx.description.trim().toLowerCase();
            if (norm.length < 2) continue;
            const key = `${tx.date}|${tx.amount}|${norm}|${tx.accountId}`;
            const arr = seen.get(key) ?? [];
            arr.push(tx);
            seen.set(key, arr);
        }
        for (const [key, list] of seen) {
            if (list.length < 2) continue;
            for (const t of list) duplicateTxIds.add(t.id);
            duplicates.push({
                key,
                date: list[0].date,
                description: list[0].description,
                amount: round2(list[0].amount),
                count: list.length,
            });
        }
        duplicates.sort((a, b) => b.amount * b.count - a.amount * a.count);
    }

    const anomalies: Anomaly[] = [];
    {
        const byCat = new Map<string, number[]>();
        for (const tx of txs) {
            if (tx.type !== "expense") continue;
            const arr = byCat.get(tx.destinationId) ?? [];
            arr.push(tx.amount);
            byCat.set(tx.destinationId, arr);
        }
        for (const tx of periodTx) {
            if (tx.type !== "expense") continue;
            if (duplicateTxIds.has(tx.id)) continue; // already reported as a double entry
            const hist = byCat.get(tx.destinationId) ?? [];
            if (hist.length < 5) continue;
            const med = median(hist);
            if (med <= 0) continue;
            const ratio = tx.amount / med;
            const spread = mad(hist, med);
            const modZ = spread > 0 ? (0.6745 * (tx.amount - med)) / spread : ratio;
            if (ratio >= 4 && modZ >= 3.5 && tx.amount >= anomalyFloor) {
                anomalies.push({
                    id: tx.id,
                    date: tx.date,
                    description: tx.description || categoryById.get(tx.destinationId)?.name || "(no description)",
                    categoryName: categoryById.get(tx.destinationId)?.name ?? "Uncategorised",
                    amount: round2(tx.amount),
                    categoryMedian: round2(med),
                    timesTypical: round2(ratio),
                });
            }
        }
        anomalies.sort((a, b) => b.timesTypical - a.timesTypical);
    }

    // ---- frequency view: the "small purchases add up" angle ----
    const frequency = spendingByCategory
        .map((c) => ({
            categoryId: c.categoryId,
            name: c.name,
            color: c.color,
            txCount: c.txCount,
            avgTx: c.avgTx,
            amount: c.amount,
            perWeek: period.elapsedDays > 0 ? round2((c.txCount / period.elapsedDays) * 7) : 0,
        }))
        .sort((a, b) => b.txCount - a.txCount);

    // ---- weekday pattern (over the selected period, not the heatmap window) ----
    const weekdayTotals = new Array(7).fill(0) as number[];
    const weekdayDayCounts = new Array(7).fill(0) as number[];
    for (const tx of periodTx) {
        if (tx.type !== "expense") continue;
        weekdayTotals[weekdayIndex(tx.date)] += tx.amount;
    }
    {
        const wEnd = period.end > today ? today : period.end;
        for (let d = period.start; d <= wEnd; d = addDays(d, 1)) weekdayDayCounts[weekdayIndex(d)] += 1;
    }
    const byWeekday = WEEKDAY_NAMES.map((name, i) => ({
        name,
        total: round2(weekdayTotals[i]),
        avg: weekdayDayCounts[i] ? round2(weekdayTotals[i] / weekdayDayCounts[i]) : 0,
    }));
    const weekendTotal = round2(weekdayTotals[5] + weekdayTotals[6]);
    const weekdaySpendTotal = round2(sum(weekdayTotals));

    // ---- accounts ----
    const balances: Record<string, number> = {};
    for (const a of accounts) balances[a.id] = a.initialBalance;
    for (const tx of txs) {
        if (tx.type === "expense") balances[tx.accountId] = (balances[tx.accountId] ?? 0) - tx.amount;
        else if (tx.type === "income") balances[tx.accountId] = (balances[tx.accountId] ?? 0) + tx.amount;
        else {
            balances[tx.accountId] = (balances[tx.accountId] ?? 0) - tx.amount;
            if (tx.destinationId in balances) balances[tx.destinationId] += tx.amount;
        }
    }
    const accountActivity = accounts.map((acc) => {
        let income = 0;
        let expenses = 0;
        let transfersIn = 0;
        let transfersOut = 0;
        for (const tx of periodTx) {
            if (tx.type === "income" && tx.accountId === acc.id) income += tx.amount;
            else if (tx.type === "expense" && tx.accountId === acc.id) expenses += tx.amount;
            else if (tx.type === "transfer") {
                if (tx.accountId === acc.id) transfersOut += tx.amount;
                if (tx.destinationId === acc.id) transfersIn += tx.amount;
            }
        }
        const balance = round2(balances[acc.id] ?? 0);
        return {
            accountId: acc.id,
            name: acc.name,
            balance,
            share: currentNetWorth !== 0 ? round2((balance / currentNetWorth) * 100) : null,
            income: round2(income),
            expenses: round2(expenses),
            transfersIn: round2(transfersIn),
            transfersOut: round2(transfersOut),
            net: round2(income - expenses + transfersIn - transfersOut),
        };
    });

    // ---- top expenses ----
    const topExpenses = periodTx
        .filter((tx) => tx.type === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 15)
        .map((tx) => ({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            categoryName: categoryById.get(tx.destinationId)?.name ?? "Uncategorised",
            accountName: accountById.get(tx.accountId)?.name ?? "Unknown",
            amount: round2(tx.amount),
        }));

    // ---- dormant categories: used to spend here regularly, hasn't in a while ----
    const dormant: DormantCategory[] = [];
    {
        const windowKeys = allMonthKeys.slice(-13); // 12 complete + the in-progress one
        const perCat = new Map<string, Map<string, number>>();
        const lastSeen = new Map<string, string>();
        for (const tx of txs) {
            if (tx.type !== "expense") continue;
            const k = monthKey(tx.date);
            if (!windowKeys.includes(k)) continue;
            const m = perCat.get(tx.destinationId) ?? new Map<string, number>();
            m.set(k, (m.get(k) ?? 0) + tx.amount);
            perCat.set(tx.destinationId, m);
            const prev = lastSeen.get(tx.destinationId);
            if (!prev || tx.date > prev) lastSeen.set(tx.destinationId, tx.date);
        }
        for (const [id, byMonth] of perCat) {
            const cat = categoryById.get(id);
            if (!cat) continue;
            const activeMonths = [...byMonth.values()].filter((v) => v > 0).length;
            // A habit, not a one-off: at least three months where money actually moved.
            if (activeMonths < 3) continue;
            const last = lastSeen.get(id)!;
            const monthsSince = Math.floor(diffDays(last, today) / 30.44);
            if (monthsSince < 2) continue;
            const typicalMonthly = round2(sum([...byMonth.values()]) / activeMonths);
            // Below this, "you stopped buying X" is noise rather than news.
            if (typicalMonthly < 15) continue;
            dormant.push({
                categoryId: id,
                name: cat.name,
                lastDate: last,
                monthsSince,
                typicalMonthly,
                activeMonths,
                notSpentSince: round2(typicalMonthly * monthsSince),
            });
        }
        dormant.sort((a, b) => b.notSpentSince - a.notSpentSince);
    }

    // ---- first-time purchases: never appeared in the ledger before this period ----
    const firstTime: FirstTime[] = [];
    {
        // Meaningless unless there is a "before" to compare against.
        if (earliest < period.start) {
            const floor = Math.max(20, summary.expenses * 0.02);
            const seenDesc = new Set<string>();
            const seenCat = new Set<string>();
            for (const tx of txs) {
                if (tx.type !== "expense") continue;
                if (tx.date >= period.start) break; // txs is date-sorted
                const norm = tx.description.trim().toLowerCase().replace(/\s+/g, " ");
                if (norm.length >= 3) seenDesc.add(norm);
                seenCat.add(tx.destinationId);
            }
            // Sorted by amount descending so, when a merchant appears more than once this
            // period, the entry we keep is the largest one, not just the first chronologically.
            const periodExpenses = periodTx
                .filter((tx) => tx.type === "expense")
                .slice()
                .sort((a, b) => b.amount - a.amount);
            const claimed = new Set<string>();
            for (const tx of periodExpenses) {
                if (tx.amount < floor) continue;
                const norm = tx.description.trim().toLowerCase().replace(/\s+/g, " ");
                if (norm.length < 3) continue; // blank descriptions carry no signal
                if (seenDesc.has(norm)) continue;
                if (claimed.has(norm)) continue;
                claimed.add(norm);
                firstTime.push({
                    id: tx.id,
                    date: tx.date,
                    description: tx.description,
                    categoryName: categoryById.get(tx.destinationId)?.name ?? "Uncategorised",
                    amount: round2(tx.amount),
                    isNewCategory: !seenCat.has(tx.destinationId),
                });
            }
            firstTime.sort((a, b) => b.amount - a.amount);
        }
    }
    const firstTimeTotal = round2(sum(firstTime.map((f) => f.amount)));

    // ---- transaction-size distribution ----
    let sizeDistribution: SizeDistribution | null = null;
    {
        const amounts = periodTx.filter((t) => t.type === "expense").map((t) => t.amount);
        // Below this the buckets are all 0s and 1s and the chart says nothing.
        if (amounts.length >= 8) {
            const EDGES: { label: string; min: number; max: number }[] = [
                { label: "< €10", min: 0, max: 10 },
                { label: "€10–25", min: 10, max: 25 },
                { label: "€25–50", min: 25, max: 50 },
                { label: "€50–100", min: 50, max: 100 },
                { label: "€100–250", min: 100, max: 250 },
                { label: "€250–500", min: 250, max: 500 },
                { label: "€500+", min: 500, max: Infinity },
            ];
            const total = sum(amounts);
            const buckets: SizeBucket[] = EDGES.map((e) => {
                const inBucket = amounts.filter((a) => a >= e.min && a < e.max);
                const t = sum(inBucket);
                return {
                    label: e.label,
                    count: inBucket.length,
                    total: round2(t),
                    countShare: round2((inBucket.length / amounts.length) * 100),
                    spendShare: total > 0 ? round2((t / total) * 100) : 0,
                };
            });
            const sorted = [...amounts].sort((a, b) => b - a);
            const topN = Math.max(1, Math.round(amounts.length * 0.1));
            const under25 = amounts.filter((a) => a < 25);
            sizeDistribution = {
                buckets,
                txCount: amounts.length,
                topDecileCount: topN,
                medianTx: round2(median(amounts)),
                p90Tx: round2(sorted[Math.min(sorted.length - 1, topN - 1)]),
                top10PctShare: total > 0 ? round2((sum(sorted.slice(0, topN)) / total) * 100) : 0,
                under25Share: total > 0 ? round2((sum(under25) / total) * 100) : 0,
                under25Count: under25.length,
            };
        }
    }

    // ---- year over year: same window, twelve months earlier ----
    let yoy: YoY | null = null;
    {
        // "year" mode is excluded: its previous-period comparison already IS last year.
        const eligible = period.mode === "month" || period.mode === "3m" || period.mode === "12m";
        if (eligible && allMonthKeys.length >= 13) {
            const yStart = shiftIsoMonths(period.start, -12);
            let yEnd = shiftIsoMonths(period.end, -12);
            let truncated = false;
            if (period.isPartial && period.elapsedDays > 0) {
                const t = addDays(yStart, period.elapsedDays - 1);
                if (t < yEnd) {
                    yEnd = t;
                    truncated = true;
                }
            }
            if (earliest <= yEnd) {
                const yTx = inRange(txs, yStart, yEnd);
                const t = totalsFor(yTx);
                const thenByCat = new Map<string, number>();
                for (const tx of yTx) {
                    if (tx.type !== "expense") continue;
                    thenByCat.set(tx.destinationId, (thenByCat.get(tx.destinationId) ?? 0) + tx.amount);
                }
                yoy = {
                    label:
                        period.mode === "month"
                            ? monthLabel(monthKey(yStart))
                            : `${shortMonthLabel(monthKey(yStart))} – ${shortMonthLabel(monthKey(yEnd))}`,
                    start: yStart,
                    end: yEnd,
                    truncated,
                    partialHistory: earliest > yStart,
                    income: t.income,
                    expenses: t.expenses,
                    netSavings: t.netSavings,
                    expensesDelta: delta(summary.expenses, t.expenses),
                    incomeDelta: delta(summary.income, t.income),
                    categories: spendingByCategory.slice(0, 6).map((c) => {
                        const then = round2(thenByCat.get(c.categoryId) ?? 0);
                        return {
                            categoryId: c.categoryId,
                            name: c.name,
                            now: c.amount,
                            then,
                            changePct: pctChange(c.amount, then),
                        };
                    }),
                };
            }
        }
    }

    // ---- savings streak over complete months ----
    let savingsStreak = 0;
    {
        const complete = monthlySeriesFull.filter((m) => m.month < monthKey(today));
        for (let i = complete.length - 1; i >= 0; i--) {
            if (complete[i].netSavings > 0) savingsStreak++;
            else break;
        }
    }

    // ---- data quality ----
    // Blank descriptions weaken every description-based feature.
    const blankDescriptions = periodTx.filter((tx) => tx.description.trim().length === 0).length;
    // Everything here assumes the ledger is current. In a manually-entered app it often
    // isn't, and a gap since the last entry silently deflates totals, deltas and forecasts —
    // "spending is way down" is indistinguishable from "I haven't logged anything lately".
    const lastTxDate = txs.length > 0 ? txs[txs.length - 1].date : null;
    const daysSinceLastTx = lastTxDate ? diffDays(lastTxDate, today) : null;

    // ---- pacing: a daily allowance derived from your own history ----
    // Deliberately not a budget you set — it's "what daily rate lands this period on your
    // own typical total", which is actionable without inventing a target.
    let pacing: {
        currentDailyRate: number;
        typicalDailyRate: number | null;
        remainingDays: number;
        allowancePerDay: number | null;
        alreadyOverTypical: boolean;
    } | null = null;
    if (period.elapsedDays > 0) {
        const remainingDays = Math.max(0, period.totalDays - period.elapsedDays);
        const currentDailyRate = round2(summary.expenses / period.elapsedDays);
        const typicalDailyRate = baselineExpenses !== null ? round2(baselineExpenses / 30.44) : null;
        let allowancePerDay: number | null = null;
        let alreadyOverTypical = false;
        if (baselineExpenses !== null && remainingDays > 0) {
            const left = baselineExpenses - summary.expenses;
            alreadyOverTypical = left <= 0;
            allowancePerDay = left > 0 ? round2(left / remainingDays) : 0;
        }
        pacing = { currentDailyRate, typicalDailyRate, remainingDays, allowancePerDay, alreadyOverTypical };
    }

    // ---- burn rate & runway ----
    const completeMonths = monthlySeriesFull.filter((m) => m.month < monthKey(today));
    const recentComplete = completeMonths.slice(-6);
    const avgMonthlyExpenses = recentComplete.length
        ? round2(sum(recentComplete.map((m) => m.expenses)) / recentComplete.length)
        : null;
    const avgMonthlyNet = recentComplete.length
        ? round2(sum(recentComplete.map((m) => m.netSavings)) / recentComplete.length)
        : null;
    // Only meaningful while you're net-negative; otherwise the balance isn't draining.
    const runwayMonths =
        avgMonthlyNet !== null && avgMonthlyNet < 0 && currentNetWorth > 0
            ? round2(currentNetWorth / Math.abs(avgMonthlyNet))
            : null;
    const coverMonths =
        avgMonthlyExpenses !== null && avgMonthlyExpenses > 0 && currentNetWorth > 0
            ? round2(currentNetWorth / avgMonthlyExpenses)
            : null;

    // ---- net-worth trajectory & milestone ETA ----
    let trajectory: Trajectory | null = null;
    {
        const nets = recentComplete.map((m) => m.netSavings);
        // Three complete months is the floor: two points is a line through noise.
        if (nets.length >= 3 && avgMonthlyNet !== null) {
            const sd = round2(stdev(nets));
            const direction = avgMonthlyNet > 25 ? "up" : avgMonthlyNet < -25 ? "down" : "flat";
            const HORIZON = 6;

            // --- chart points: last 6 actual months, then 6 projected ---
            const actualTail = monthlySeriesFull.slice(-6);
            const points: TrajectoryPoint[] = actualTail.map((m, i) => ({
                label: m.label,
                actual: m.netWorthEnd,
                // The final actual point carries the projection's start value too, otherwise
                // Recharts draws the forecast as a detached segment with a visible gap.
                central: i === actualTail.length - 1 ? currentNetWorth : null,
                low: i === actualTail.length - 1 ? currentNetWorth : null,
                high: i === actualTail.length - 1 ? currentNetWorth : null,
            }));
            const lastKey = actualTail[actualTail.length - 1].month;
            for (let i = 1; i <= HORIZON; i++) {
                points.push({
                    label: shortMonthLabel(shiftMonth(lastKey, i)),
                    actual: null,
                    central: round2(currentNetWorth + avgMonthlyNet * i),
                    low: round2(currentNetWorth + (avgMonthlyNet - sd) * i),
                    high: round2(currentNetWorth + (avgMonthlyNet + sd) * i),
                });
            }

            // --- milestones ---
            const milestones: Milestone[] = [];
            const monthsTo = (target: number, pace: number): number | null => {
                if (pace === 0) return null;
                const m = (target - currentNetWorth) / pace;
                return m > 0 && m <= 36 ? round2(m) : null;
            };
            const build = (target: number): Milestone | null => {
                const monthsAway = monthsTo(target, avgMonthlyNet!);
                if (monthsAway === null) return null;
                const etaDate = addDays(today, Math.round(monthsAway * 30.44));
                return {
                    target: round2(target),
                    monthsAway,
                    etaDate,
                    etaLabel: vagueDateLabel(etaDate),
                    optimisticMonths: monthsTo(target, avgMonthlyNet! + sd),
                    cautiousMonths: monthsTo(target, avgMonthlyNet! - sd),
                };
            };

            if (direction === "up") {
                const mag = Math.max(1000, Math.abs(currentNetWorth));
                const pow = Math.pow(10, Math.floor(Math.log10(mag)));
                const stepSize = Math.max(250, pow / 2);
                const first = Math.ceil((currentNetWorth + 1) / stepSize) * stepSize;
                for (let i = 0; i < 3; i++) {
                    const ms = build(first + i * stepSize);
                    if (ms) milestones.push(ms);
                }
            } else if (direction === "down" && currentNetWorth > 0) {
                // Downward, the only milestone anyone cares about is zero.
                const ms = build(0);
                if (ms) milestones.push(ms);
            }

            trajectory = {
                direction,
                monthlyNet: avgMonthlyNet,
                monthlyNetSd: sd,
                monthsUsed: nets.length,
                basis: `Based on your average of ${money0(avgMonthlyNet)} a month across your last ${nets.length} complete months (swing of about ${money0(sd)}).`,
                points,
                milestones,
            };
        }
    }

    // ---- payday-cycle analysis ----
    let payday: PaydayProfile | null = null;
    {
        const windowKeys = allMonthKeys.slice(-12);
        const windowSet = new Set(windowKeys);
        // The largest income transaction of each month is the closest thing to "payday" that
        // needs no configuration from the user. Small incidental income is ignored by design.
        const biggestPerMonth = new Map<string, AnalyticsTx>();
        for (const tx of txs) {
            if (tx.type !== "income") continue;
            const k = monthKey(tx.date);
            if (!windowSet.has(k)) continue;
            const cur = biggestPerMonth.get(k);
            if (!cur || tx.amount > cur.amount) biggestPerMonth.set(k, tx);
        }
        // Exclude the in-progress month: this month's salary may simply not have landed yet.
        const complete = [...biggestPerMonth.entries()]
            .filter(([k]) => k < monthKey(today))
            .sort((a, b) => (a[0] < b[0] ? -1 : 1));

        if (complete.length >= 3) {
            const days = complete.map(([, tx]) => Number(tx.date.slice(8, 10)));
            const medDay = Math.round(median(days));
            const spread = mad(days, medDay);
            // A rhythm that wanders by more than a few days is not a rhythm.
            if (spread <= 3 && medDay >= 1 && medDay <= 31) {
                const startOf = (key: string): string => {
                    const [y, m] = key.split("-").map(Number);
                    return `${key}-${String(Math.min(medDay, daysInMonth(y, m))).padStart(2, "0")}`;
                };
                const starts: string[] = [];
                for (let k = windowKeys[0]; k <= shiftMonth(monthKey(today), 1); k = shiftMonth(k, 1)) {
                    starts.push(startOf(k));
                }

                const BUCKETS = [
                    { label: "Days 1–7", from: 0, to: 6 },
                    { label: "Days 8–14", from: 7, to: 13 },
                    { label: "Days 15–21", from: 14, to: 20 },
                    { label: "Days 22+", from: 21, to: 400 },
                ];
                const bucketTotals = new Array(BUCKETS.length).fill(0) as number[];
                let cycles = 0;
                let incomeTotal = 0;
                let spendTotal = 0;
                const cycleSpendByOffset: number[][] = [];

                for (let i = 0; i < starts.length - 1; i++) {
                    const s = starts[i];
                    const e = addDays(starts[i + 1], -1);
                    if (e >= today) continue; // only complete cycles
                    if (s < earliest) continue; // no data to speak of
                    cycles++;
                    const cum: number[] = [];
                    let acc = 0;
                    for (let d = s, off = 0; d <= e; d = addDays(d, 1), off++) {
                        const spent = dailyExpense.get(d) ?? 0;
                        acc += spent;
                        cum[off] = acc;
                        incomeTotal += dailyIncome.get(d) ?? 0;
                        spendTotal += spent;
                        const bi = BUCKETS.findIndex((b) => off >= b.from && off <= b.to);
                        if (bi >= 0) bucketTotals[bi] += spent;
                    }
                    cycleSpendByOffset.push(cum);
                }

                if (cycles >= 2) {
                    const avgSpendPerCycle = round2(spendTotal / cycles);
                    const buckets = BUCKETS.map((b, i) => ({
                        label: b.label,
                        avgSpend: round2(bucketTotals[i] / cycles),
                        share: spendTotal > 0 ? round2((bucketTotals[i] / spendTotal) * 100) : 0,
                    }));

                    // Current position in the cycle
                    let cycleStart = starts[0];
                    let nextStart = starts[starts.length - 1];
                    for (let i = 0; i < starts.length; i++) {
                        if (starts[i] <= today) cycleStart = starts[i];
                        if (starts[i] > today) {
                            nextStart = starts[i];
                            break;
                        }
                    }
                    const daysSincePayday = diffDays(cycleStart, today);
                    let spentSincePayday = 0;
                    for (let d = cycleStart; d <= today; d = addDays(d, 1)) {
                        spentSincePayday += dailyExpense.get(d) ?? 0;
                    }
                    // What past cycles had spent by the same day-offset — the honest comparison.
                    const atSameOffset = cycleSpendByOffset
                        .map((c) => c[Math.min(daysSincePayday, c.length - 1)])
                        .filter((v) => v !== undefined);

                    payday = {
                        dayOfMonth: medDay,
                        consistency: Math.round(Math.max(0, Math.min(100, 100 - spread * 25))),
                        cyclesAnalysed: cycles,
                        avgIncomePerCycle: round2(incomeTotal / cycles),
                        avgSpendPerCycle,
                        buckets,
                        frontloadPct: buckets[0].share,
                        cycleStart,
                        daysSincePayday,
                        daysUntilNextPayday: Math.max(0, diffDays(today, nextStart)),
                        spentSincePayday: round2(spentSincePayday),
                        typicalSpentByThisPoint: atSameOffset.length ? round2(sum(atSameOffset) / atSameOffset.length) : null,
                    };
                }
            }
        }
    }

    // ---- category momentum: consecutive same-direction months ----
    type Momentum = {
        categoryId: string;
        name: string;
        streak: number;
        direction: "rising" | "falling";
        values: number[];
    };
    const momentum: Momentum[] = [];
    {
        const window = allMonthKeys.slice(-6);
        const perCat = new Map<string, number[]>();
        for (const key of window) {
            const monthTx = inRange(txs, monthStart(key), monthEnd(key));
            const per = new Map<string, number>();
            for (const tx of monthTx) {
                if (tx.type !== "expense") continue;
                per.set(tx.destinationId, (per.get(tx.destinationId) ?? 0) + tx.amount);
            }
            for (const c of categories) {
                if (c.type !== "expense") continue;
                const arr = perCat.get(c.id) ?? [];
                arr.push(round2(per.get(c.id) ?? 0));
                perCat.set(c.id, arr);
            }
        }
        for (const [id, vals] of perCat) {
            // Ignore the in-progress month: a partial figure always looks like a fall.
            const series = monthKey(today) === window[window.length - 1] ? vals.slice(0, -1) : vals;
            if (series.length < 4) continue;

            const rising = series[series.length - 1] > series[series.length - 2];
            let streak = 0;
            for (let i = series.length - 1; i > 0; i--) {
                const diff = series[i] - series[i - 1];
                // An unchanged month breaks the run — otherwise a category sitting at zero
                // every month reads as a long "falling" streak, which is meaningless.
                if (diff === 0) break;
                if (diff > 0 !== rising) break;
                streak++;
            }
            if (streak < 3) continue;

            const window2 = series.slice(series.length - 1 - streak);
            const from = window2[0];
            const to = window2[window2.length - 1];
            // Ignore immaterial drift so this surfaces real trends, not rounding noise.
            if (Math.abs(to - from) < 15) continue;

            const cat = categoryById.get(id);
            if (!cat) continue;
            momentum.push({
                categoryId: id,
                name: cat.name,
                streak,
                direction: rising ? "rising" : "falling",
                values: window2,
            });
        }
        momentum.sort((a, b) => b.streak - a.streak);
    }

    // ---- where this period ranks among comparable ones ----
    let periodRank: { rank: number; total: number; cheaperThan: number } | null = null;
    if (period.mode === "month" && completeMonths.length >= 3 && !period.isPartial) {
        const sorted = [...completeMonths].sort((a, b) => a.expenses - b.expenses);
        const idx = sorted.findIndex((m) => m.month === period.anchor);
        if (idx >= 0) {
            periodRank = { rank: idx + 1, total: sorted.length, cheaperThan: sorted.length - idx - 1 };
        }
    }

    // ---- volatility & concentration ----
    const monthlyExpenseValues = recentComplete.map((m) => m.expenses);
    const meanExp = monthlyExpenseValues.length ? sum(monthlyExpenseValues) / monthlyExpenseValues.length : 0;
    const volatility =
        monthlyExpenseValues.length >= 3 && meanExp > 0
            ? round2(
                  (Math.sqrt(
                      sum(monthlyExpenseValues.map((v) => (v - meanExp) ** 2)) / monthlyExpenseValues.length
                  ) /
                      meanExp) *
                      100
              )
            : null;
    const top3Share =
        summary.expenses > 0
            ? round2((sum(spendingByCategory.slice(0, 3).map((c) => c.amount)) / summary.expenses) * 100)
            : null;
    const fixedShare =
        summary.expenses > 0 && fixedMonthlyEstimate > 0
            ? round2(Math.min(100, (fixedMonthlyEstimate / summary.expenses) * 100))
            : null;

    // ---- health score ----
    // Every component is scored against this user's OWN history rather than invented
    // industry norms, and the breakdown is returned so the number is never a black box.
    type HealthPart = { key: string; label: string; score: number; weight: number; note: string };
    const healthParts: HealthPart[] = [];
    {
        const rate = summary.savingsRate;
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
        if (recentComplete.length >= 3) {
            const first = recentComplete[0].netWorthEnd;
            const last = recentComplete[recentComplete.length - 1].netWorthEnd;
            const grew = last - first;
            const s = grew >= 0 ? Math.min(100, 55 + (grew / Math.max(1, Math.abs(first))) * 200) : Math.max(0, 55 + (grew / Math.max(1, Math.abs(first))) * 200);
            healthParts.push({
                key: "trend",
                label: "Net worth trend",
                score: Math.round(Math.max(0, Math.min(100, s))),
                weight: 3,
                note: grew >= 0 ? `up ${money0(grew)} over ${recentComplete.length} months` : `down ${money0(-grew)} over ${recentComplete.length} months`,
            });
        }
        if (volatility !== null) {
            healthParts.push({
                key: "stability",
                label: "Spending stability",
                score: Math.round(Math.max(0, Math.min(100, 100 - volatility * 1.6))),
                weight: 2,
                note: `${volatility.toFixed(0)}% month-to-month swing`,
            });
        }
        if (fixedShare !== null) {
            healthParts.push({
                key: "flexibility",
                label: "Flexibility",
                score: Math.round(Math.max(0, Math.min(100, 100 - fixedShare))),
                weight: 2,
                note: `${fixedShare.toFixed(0)}% of spend is committed`,
            });
        }
        if (coverMonths !== null) {
            healthParts.push({
                key: "cushion",
                label: "Cushion",
                score: Math.round(Math.max(0, Math.min(100, (coverMonths / 6) * 100))),
                weight: 2,
                note: `${coverMonths.toFixed(1)} months of expenses covered`,
            });
        }
    }
    const healthWeight = sum(healthParts.map((p) => p.weight));
    const healthScore = healthWeight > 0 ? Math.round(sum(healthParts.map((p) => p.score * p.weight)) / healthWeight) : null;
    const healthLabel =
        healthScore === null
            ? "Not enough history"
            : healthScore >= 75
              ? "Looking strong"
              : healthScore >= 55
                ? "Tracking well"
                : healthScore >= 35
                  ? "Worth attention"
                  : "Needs a look";

    // Whether finishing above a typical period is genuinely in play — gates the pacing
    // advice so it never suggests a daily allowance to someone nowhere near the line.
    const atRiskOfExceeding =
        baselineExpenses !== null && projection !== null && projection.expenses >= baselineExpenses * 0.85;

    // ---- insight engine ----
    const insights: Insight[] = [];
    const push = (i: Insight) => insights.push(i);
    const money = (n: number) => `€${n.toFixed(2)}`;

    // A completed period that ended in the red is a fact; an in-progress one is only a
    // forecast, and shouting "you overspent" on the 25th before payday would be wrong.
    if (!period.isPartial && summary.netSavings < 0) {
        push({
            id: "negative-savings",
            severity: "critical",
            title: `You spent ${money(Math.abs(summary.netSavings))} more than you earned`,
            detail: `${money(summary.expenses)} out vs ${money(summary.income)} in over ${period.label}.`,
            score: 100 + Math.abs(summary.netSavings),
        });
    } else if (period.isPartial && projection && projection.netSavings < 0) {
        push({
            id: "projected-negative-savings",
            severity: "warn",
            title: `Heading for a ${money(Math.abs(projection.netSavings))} shortfall this period`,
            detail: `Projected ${money(projection.expenses)} out vs ${money(projection.income)} in. ${projection.basis}.`,
            score: 85 + Math.abs(projection.netSavings),
        });
    }

    if (projection && baselineExpenses !== null) {
        const overPct = pctChange(projection.expenses, baselineExpenses);
        if (overPct !== null && overPct > 15) {
            push({
                id: "projected-over",
                severity: "warn",
                title: `On track to spend ${money(projection.expenses)} — ${overPct.toFixed(0)}% above typical`,
                detail: `Your last ${period.baselineMonths.length} complete months averaged ${money(baselineExpenses)}. ${projection.basis}.`,
                score: 90 + overPct,
            });
        } else if (overPct !== null && overPct < -15) {
            push({
                id: "projected-under",
                severity: "good",
                title: `On track to spend ${money(projection.expenses)} — ${Math.abs(overPct).toFixed(0)}% below typical`,
                detail: `Your last ${period.baselineMonths.length} complete months averaged ${money(baselineExpenses)}.`,
                score: 40 + Math.abs(overPct),
            });
        }
    }

    // When a category jumped because of one big charge, say so in the same insight rather
    // than emitting two findings that are really the same event.
    const consumedAnomalies = new Set<string>();
    for (const m of movers.slice(0, 4)) {
        const up = m.absChange > 0;
        const driver = up
            ? anomalies.find((a) => a.categoryName === m.name && a.amount >= Math.abs(m.absChange) * 0.6)
            : undefined;
        if (driver) consumedAnomalies.add(driver.id);

        const isNew = (m.baselineAvg ?? 0) === 0 && m.amount > 0;
        const title = isNew
            ? `${m.name} is new this period at ${money(m.amount)}`
            : `${m.name} is ${up ? "up" : "down"} ${money(Math.abs(m.absChange))} vs your usual`;
        const base = isNew
            ? `Nothing spent here in your last ${period.baselineMonths.length} complete month(s).`
            : `${money(m.amount)} this period against a ${money(m.baselineAvg ?? 0)} average${
                  m.vsBaselinePct !== null ? ` (${m.vsBaselinePct > 0 ? "+" : ""}${m.vsBaselinePct.toFixed(0)}%)` : ""
              }.`;

        push({
            id: `mover-${m.categoryId}`,
            severity: up ? "warn" : "good",
            title,
            detail: driver ? `${base} Mostly one charge: ${money(driver.amount)} on ${driver.description}.` : base,
            score: 60 + Math.abs(m.absChange),
        });
    }

    for (const a of anomalies.filter((x) => !consumedAnomalies.has(x.id)).slice(0, 2)) {
        push({
            id: `anomaly-${a.id}`,
            severity: "warn",
            title: `${money(a.amount)} on ${a.description} is ${a.timesTypical.toFixed(1)}× your typical ${a.categoryName}`,
            detail: `Usual ${a.categoryName} transaction is around ${money(a.categoryMedian)}.`,
            score: 55 + a.amount,
        });
    }

    for (const d of duplicates.slice(0, 2)) {
        push({
            id: `dupe-${d.key}`,
            severity: "warn",
            title: `Possible duplicate: ${d.count}× ${money(d.amount)} on ${d.description}`,
            detail: `All on ${d.date} in the same account — check you didn't enter it twice.`,
            score: 70 + d.amount,
        });
    }

    for (const r of activeRecurring.filter((r) => r.status === "overdue").slice(0, 2)) {
        push({
            id: `recurring-overdue-${r.key}`,
            severity: "info",
            title: `${r.description} looks overdue`,
            detail: `Normally ${r.intervalLabel} at about ${money(r.avgAmount)}; last seen ${r.lastDate}, expected around ${r.nextExpected}.`,
            score: 30,
        });
    }

    if (fixedMonthlyEstimate > 0) {
        push({
            id: "fixed-costs",
            severity: "info",
            title: `About ${money(fixedMonthlyEstimate)}/month of your spending is recurring`,
            detail: `${activeRecurring.filter((r) => !r.amountVaries).length} charge(s) repeat on a predictable schedule.`,
            score: 25,
        });
    }

    const topFreq = frequency[0];
    if (topFreq && topFreq.txCount >= 8) {
        // Quantify the counterfactual rather than vaguely suggesting "spend less".
        const third = round2(topFreq.amount / 3);
        push({
            id: "frequency",
            severity: "info",
            title: `${topFreq.txCount} ${topFreq.name} purchases averaging ${money(topFreq.avgTx)} = ${money(topFreq.amount)}`,
            detail: `That's about ${topFreq.perWeek.toFixed(1)} a week — small amounts, but they add up.`,
            advice: `Dropping roughly one in three would keep about ${money(third)} over a period like this.`,
            score: 35 + topFreq.amount,
        });
    }

    if (pacing && period.isPartial && pacing.remainingDays > 0 && baselineExpenses !== null) {
        if (pacing.alreadyOverTypical) {
            push({
                id: "pacing-over",
                severity: "warn",
                title: `Already past your usual ${money(baselineExpenses)} with ${pacing.remainingDays} days left`,
                detail: `You're averaging ${money(pacing.currentDailyRate)} a day this period.`,
                advice: `Anything further this period puts you above every one of your last ${period.baselineMonths.length} months.`,
                score: 80,
            });
        } else if (atRiskOfExceeding && pacing.allowancePerDay !== null && pacing.typicalDailyRate !== null) {
            push({
                id: "pacing-allowance",
                severity: "info",
                title: `About ${money(pacing.allowancePerDay)}/day left to match a typical period`,
                detail: `You're at ${money(pacing.currentDailyRate)}/day against a typical ${money(pacing.typicalDailyRate)}/day, with ${pacing.remainingDays} days to go.`,
                score: 42,
            });
        }
    }

    for (const m of momentum.filter((x) => x.direction === "rising").slice(0, 2)) {
        push({
            id: `momentum-${m.categoryId}`,
            severity: "warn",
            title: `${m.name} has risen ${m.streak} months in a row`,
            detail: `${m.values.map((v) => money(v)).join(" → ")}.`,
            advice: `A steady climb is easier to correct early than after it becomes your new normal.`,
            score: 65 + m.streak * 5,
        });
    }

    if (runwayMonths !== null && runwayMonths < 12) {
        push({
            id: "runway",
            severity: runwayMonths < 6 ? "warn" : "info",
            title: `At your recent rate, savings would last about ${runwayMonths.toFixed(1)} months`,
            detail: `Based on an average monthly shortfall over your last ${recentComplete.length} complete months.`,
            score: 78,
        });
    }

    if (trajectory && trajectory.milestones.length > 0) {
        const ms = trajectory.milestones[0];
        push({
            id: "milestone",
            severity: trajectory.direction === "down" ? "warn" : "good",
            title:
                trajectory.direction === "down"
                    ? `At this rate you'd reach zero around ${ms.etaLabel}`
                    : `On pace to pass ${money(ms.target)} around ${ms.etaLabel}`,
            detail: trajectory.basis,
            // Below one month, "pushes that to about 0 months" is nonsense — the milestone
            // is imminent regardless of pace variance, so a cautious/optimistic hedge adds
            // nothing worth saying.
            advice:
                ms.cautiousMonths !== null && ms.optimisticMonths !== null && ms.cautiousMonths >= 1
                    ? `A slower month or two pushes that to about ${ms.cautiousMonths.toFixed(0)} months; a good run gets there in ${ms.optimisticMonths.toFixed(0)}.`
                    : undefined,
            score: trajectory.direction === "down" ? 82 : 44,
        });
    }

    if (payday) {
        if (payday.frontloadPct >= 40) {
            push({
                id: "payday-frontload",
                severity: "info",
                title: `${payday.frontloadPct.toFixed(0)}% of each pay cycle is spent in the first week`,
                detail: `You're paid around the ${ordinal(payday.dayOfMonth)}, and average ${money(payday.buckets[0].avgSpend)} in the seven days that follow, out of ${money(payday.avgSpendPerCycle)} for the whole cycle.`,
                advice: `Moving one large recurring purchase later in the cycle would even this out.`,
                score: 38,
            });
        }
        // Comparing "spent so far" against a historical pace is misleading when recent days
        // simply haven't been logged yet — that reads as underspending when it's really a
        // data gap (the same trap the "stale-data" insight above exists to catch).
        const dataIsFresh = daysSinceLastTx === null || daysSinceLastTx < 5;
        if (dataIsFresh && payday.typicalSpentByThisPoint !== null && payday.typicalSpentByThisPoint > 0) {
            const diffPct = pctChange(payday.spentSincePayday, payday.typicalSpentByThisPoint);
            if (diffPct !== null && Math.abs(diffPct) >= 20) {
                const ahead = diffPct > 0;
                push({
                    id: "payday-pace",
                    severity: ahead ? "warn" : "good",
                    title: `${Math.abs(diffPct).toFixed(0)}% ${ahead ? "ahead of" : "behind"} your usual pay-cycle pace`,
                    detail: `${payday.daysSincePayday} days since payday you've spent ${money(payday.spentSincePayday)}; by this point you're normally at ${money(payday.typicalSpentByThisPoint)}. ${payday.daysUntilNextPayday} days until the next one.`,
                    score: ahead ? 72 : 36,
                });
            }
        }
    }

    for (const d of dormant.slice(0, 2)) {
        push({
            id: `dormant-${d.categoryId}`,
            severity: "good",
            title: `Nothing spent on ${d.name} for ${d.monthsSince} month(s)`,
            detail: `You used to average ${money(d.typicalMonthly)} a month across ${d.activeMonths} months; last entry was ${d.lastDate}.`,
            advice: `That's roughly ${money(d.notSpentSince)} not spent — unless it moved somewhere else in your ledger.`,
            score: 34,
        });
    }

    if (firstTime.length >= 2) {
        push({
            id: "first-time",
            severity: "info",
            title: `${firstTime.length} things you'd never bought before, ${money(firstTimeTotal)} in total`,
            detail: firstTime.slice(0, 3).map((f) => `${f.description} (${money(f.amount)})`).join(", ") + ".",
            score: 30,
        });
    }

    if (sizeDistribution) {
        const sd = sizeDistribution;
        if (sd.top10PctShare >= 50) {
            push({
                id: "size-concentration",
                severity: "info",
                title: `${sd.top10PctShare.toFixed(0)}% of your spending came from your ${sd.topDecileCount} largest purchase(s)`,
                detail: `Your median transaction is ${money(sd.medianTx)}, but the top tenth are ${money(sd.p90Tx)} and up.`,
                advice: `A period like this is decided by a handful of decisions, not by daily habits.`,
                score: 32,
            });
        } else if (sd.under25Share >= 40) {
            push({
                id: "size-small-leak",
                severity: "info",
                title: `${sd.under25Count} purchases under €25 account for ${sd.under25Share.toFixed(0)}% of your spending`,
                detail: `No single one is large; together they're ${money(sd.buckets[0].total + sd.buckets[1].total)}.`,
                advice: `This is the kind of spend that only changes through habit, not through one decision.`,
                score: 32,
            });
        }
    }

    if (yoy && yoy.expensesDelta && yoy.expensesDelta.changePct !== null && Math.abs(yoy.expensesDelta.changePct) >= 12) {
        const up = yoy.expensesDelta.changePct > 0;
        push({
            id: "yoy",
            severity: up ? "warn" : "good",
            title: `${Math.abs(yoy.expensesDelta.changePct).toFixed(0)}% ${up ? "more" : "less"} than the same period last year`,
            detail: `${money(summary.expenses)} now against ${money(yoy.expenses)} in ${yoy.label}.${yoy.partialHistory ? " Your records don't cover all of that window, so it may understate the comparison." : ""}`,
            score: up ? 68 : 39,
        });
    }

    if (fixedShare !== null && fixedShare >= 55) {
        push({
            id: "fixed-heavy",
            severity: "info",
            title: `${fixedShare.toFixed(0)}% of this period's spending is committed`,
            detail: `Recurring charges come to about ${money(fixedMonthlyEstimate)} a month, leaving ${money(Math.max(0, summary.expenses - fixedMonthlyEstimate))} that's genuinely discretionary.`,
            advice: `With little flexible spend, a surprise cost has nowhere to absorb into.`,
            score: 33,
        });
    }

    if (currentNetWorth >= allTimeHigh && currentNetWorth > 0) {
        push({
            id: "net-worth-high",
            severity: "good",
            title: `Net worth at an all-time high of ${money(currentNetWorth)}`,
            detail: `Across ${accounts.length} account(s).`,
            score: 45,
        });
    } else if (drawdownPct >= 10) {
        push({
            id: "drawdown",
            severity: "warn",
            title: `Net worth is ${drawdownPct.toFixed(0)}% below its peak`,
            detail: `${money(currentNetWorth)} now vs a high of ${money(allTimeHigh)} — down ${money(drawdown)}.`,
            score: 50 + drawdownPct,
        });
    }

    if (savingsStreak >= 2) {
        push({
            id: "savings-streak",
            severity: "good",
            title: `${savingsStreak} months in a row of saving money`,
            detail: `Every complete month in that run ended positive.`,
            score: 40 + savingsStreak,
        });
    }

    if (weekdaySpendTotal > 0) {
        const weekendPct = round2((weekendTotal / weekdaySpendTotal) * 100);
        if (weekendPct >= 40) {
            push({
                id: "weekend-heavy",
                severity: "info",
                title: `${weekendPct.toFixed(0)}% of your spending happens at weekends`,
                detail: `${money(weekendTotal)} of ${money(weekdaySpendTotal)} falls on Saturday or Sunday.`,
                score: 28,
            });
        }
    }

    if (noSpendDays > 0 && dailyTotals.length >= 14) {
        push({
            id: "no-spend-days",
            severity: "info",
            title: `${noSpendDays} days with no spending at all`,
            detail: `Out of ${dailyTotals.length} days in view.`,
            score: 20,
        });
    }

    if (daysSinceLastTx !== null && daysSinceLastTx >= 5 && period.isPartial) {
        push({
            id: "stale-data",
            severity: "warn",
            title: `Nothing logged for ${daysSinceLastTx} days`,
            detail: `Your last entry was ${lastTxDate}. Totals and the forecast below only count what's been entered, so they may read lower than reality.`,
            score: 95 + daysSinceLastTx,
        });
    }

    if (blankDescriptions >= 3) {
        push({
            id: "blank-descriptions",
            severity: "info",
            title: `${blankDescriptions} transactions have no description`,
            detail: `Recurring-charge and duplicate detection can't see these — adding a note makes them visible.`,
            score: 15,
        });
    }

    // Severity outranks magnitude: a large favourable swing must never bury a genuine
    // problem just because its euro delta happens to be bigger.
    const SEVERITY_RANK: Record<Insight["severity"], number> = { critical: 3, warn: 2, good: 1, info: 0 };
    insights.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.score - a.score);

    // ---- narrative briefing ----
    // Composed from the numbers above into connected prose: a verdict, what drove it, the
    // one thing going the wrong way, concrete pacing guidance, and any caveat that would
    // otherwise make the reader trust a figure they shouldn't. Fully deterministic — no
    // model involved — but written to read like an analyst's summary rather than a legend.
    const briefing: { headline: string; paragraphs: string[]; caveats: string[] } = {
        headline: "",
        paragraphs: [],
        caveats: [],
    };
    {
        const spend = money0(summary.expenses);
        const vsTypical = baselineExpenses !== null ? pctChange(summary.expenses, baselineExpenses) : null;

        // --- headline: the single most useful sentence ---
        if (summary.txCount === 0) {
            briefing.headline = `Nothing recorded for ${period.label} yet.`;
        } else if (period.isPartial && projection && baselineExpenses !== null) {
            const projPct = pctChange(projection.expenses, baselineExpenses);
            const dir = projPct === null ? "in line with" : projPct > 8 ? `${Math.abs(projPct).toFixed(0)}% above` : projPct < -8 ? `${Math.abs(projPct).toFixed(0)}% below` : "in line with";
            briefing.headline = `${period.label} is on track to finish around ${money0(projection.expenses)} — ${dir} your usual ${money0(baselineExpenses)}.`;
        } else if (vsTypical !== null) {
            const dir = vsTypical > 8 ? `${Math.abs(vsTypical).toFixed(0)}% more than usual` : vsTypical < -8 ? `${Math.abs(vsTypical).toFixed(0)}% less than usual` : "about as usual";
            briefing.headline = `You spent ${spend} in ${period.label} — ${dir}.`;
        } else {
            briefing.headline = `You spent ${spend} across ${summary.txCount} transactions in ${period.label}.`;
        }

        // --- what drove it ---
        if (summary.txCount > 0) {
            const down = movers.filter((m) => m.absChange < 0).slice(0, 2);
            const up = movers.filter((m) => m.absChange > 0).slice(0, 2);
            const downPhrases = down.map((m) => `${m.name} (${money0(Math.abs(m.absChange))} less)`);
            const upPhrases = up.map((m) => `${m.name} (${money0(m.absChange)} more)`);
            if (down.length > 0 && up.length > 0) {
                briefing.paragraphs.push(
                    `Most of the saving came from ${listPhrase(downPhrases)}, while ${listPhrase(upPhrases)} went the other way.`
                );
            } else if (down.length > 0) {
                briefing.paragraphs.push(`Most of the saving came from ${listPhrase(downPhrases)}.`);
            } else if (up.length > 0) {
                briefing.paragraphs.push(`The main pressure came from ${listPhrase(upPhrases)}.`);
            }

            // Attribute a rise to a single charge where one clearly dominates.
            const biggestUp = up[0];
            if (biggestUp) {
                const driver = anomalies.find((a) => a.categoryName === biggestUp.name);
                if (driver) {
                    briefing.paragraphs.push(
                        `That ${biggestUp.name} rise is mostly one charge — ${money0(driver.amount)} on ${driver.description}, about ${driver.timesTypical.toFixed(0)}× what you normally spend there.`
                    );
                } else {
                    const cat = spendingByCategory.find((c) => c.categoryId === biggestUp.categoryId);
                    if (cat && cat.txCount > 1) {
                        briefing.paragraphs.push(
                            `That's spread across ${cat.txCount} ${biggestUp.name} transactions averaging ${money0(cat.avgTx)}, so it's frequency rather than one big purchase.`
                        );
                    }
                }
            }

            // --- concrete pacing guidance ---
            // A "you may spend €118/day" allowance is useless when you're miles under; it only
            // becomes advice when overspending is actually in play.
            if (pacing && period.isPartial && pacing.remainingDays > 0 && baselineExpenses !== null) {
                if (pacing.alreadyOverTypical) {
                    briefing.paragraphs.push(
                        `You're already past your usual ${money0(baselineExpenses)} with ${pacing.remainingDays} days to go, currently averaging ${money0(pacing.currentDailyRate)} a day.`
                    );
                } else if (atRiskOfExceeding && pacing.allowancePerDay !== null) {
                    briefing.paragraphs.push(
                        `You're averaging ${money0(pacing.currentDailyRate)} a day. To finish on your usual ${money0(baselineExpenses)} you have roughly ${money0(pacing.allowancePerDay)} a day left across the final ${pacing.remainingDays} days.`
                    );
                } else if (pacing.typicalDailyRate !== null) {
                    briefing.paragraphs.push(
                        `At ${money0(pacing.currentDailyRate)} a day against a typical ${money0(pacing.typicalDailyRate)}, you're comfortably under with ${pacing.remainingDays} days to go.`
                    );
                }
            }

            // --- momentum, which point-in-time comparisons miss ---
            const rising = momentum.filter((m) => m.direction === "rising").slice(0, 1);
            if (rising.length > 0) {
                const m = rising[0];
                briefing.paragraphs.push(
                    `Worth watching: ${m.name} has risen ${m.streak} months running (${m.values.map((v) => money0(v)).join(" → ")}).`
                );
            }

            // --- where this sits historically ---
            if (periodRank) {
                const where =
                    periodRank.rank === 1
                        ? "cheapest"
                        : periodRank.rank === periodRank.total
                          ? "most expensive"
                          : `${ordinal(periodRank.rank)} cheapest`;
                briefing.paragraphs.push(`That makes it your ${where} of ${periodRank.total} complete months.`);
            }

            // --- year over year, when the history reaches back that far ---
            if (yoy && yoy.expensesDelta && yoy.expensesDelta.changePct !== null) {
                const p = yoy.expensesDelta.changePct;
                const phrase =
                    Math.abs(p) < 5
                        ? `almost exactly what you spent in ${yoy.label}`
                        : `${Math.abs(p).toFixed(0)}% ${p > 0 ? "more" : "less"} than ${yoy.label}`;
                briefing.paragraphs.push(`Year on year, that's ${phrase} (${money0(yoy.expenses)}).`);
            }

            // --- where you are in the pay cycle ---
            // Same staleness guard as the insight above: comparing against historical pace
            // is misleading if the gap is really unlogged days, not underspending.
            const paydayDataIsFresh = daysSinceLastTx === null || daysSinceLastTx < 5;
            if (payday && paydayDataIsFresh && payday.typicalSpentByThisPoint !== null) {
                const diff = payday.spentSincePayday - payday.typicalSpentByThisPoint;
                const rel =
                    Math.abs(diff) < 25
                        ? `right on your usual pace`
                        : `${money0(Math.abs(diff))} ${diff > 0 ? "ahead of" : "behind"} your usual pace`;
                briefing.paragraphs.push(
                    `You're ${payday.daysSincePayday} days past payday with ${payday.daysUntilNextPayday} to go, ${rel} for this point in the cycle.`
                );
            }

            // --- the forward look ---
            if (trajectory && trajectory.milestones.length > 0) {
                const ms = trajectory.milestones[0];
                briefing.paragraphs.push(
                    trajectory.direction === "down"
                        ? `If nothing changes, the ${money0(Math.abs(trajectory.monthlyNet))} a month you're currently losing would empty your accounts around ${ms.etaLabel}.`
                        : `Keeping up ${money0(trajectory.monthlyNet)} a month puts you past ${money0(ms.target)} around ${ms.etaLabel}.`
                );
            }
        }

        // --- caveats: anything that would make a number above misleading ---
        if (daysSinceLastTx !== null && daysSinceLastTx >= 5 && period.isPartial) {
            briefing.caveats.push(
                `Nothing has been logged for ${daysSinceLastTx} days (last entry ${lastTxDate}), so these figures may read lower than reality.`
            );
        }
        if (period.baselineMonths.length === 0) {
            briefing.caveats.push(
                `There aren't enough complete months before this one to compare against yet, so "usual" figures are unavailable.`
            );
        }
        if (blankDescriptions >= 3) {
            briefing.caveats.push(
                `${blankDescriptions} transactions have no description, which hides them from recurring-charge and duplicate checks.`
            );
        }
        if (yoy?.partialHistory) {
            briefing.caveats.push(
                `Your records don't reach all the way back through ${yoy.label}, so the year-on-year figure compares against an incomplete window.`
            );
        }
    }

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
            baselineMonths: period.baselineMonths,
        },
        availableMonths,
        availableYears,
        monthOptions: availableMonths.map((k) => ({ key: k, label: monthLabel(k) })),
        summary,
        comparison: {
            previous: prevTotals,
            previousTruncated: prevIsTruncated,
            baselineExpenses,
            baselineIncome,
            baselineMonthCount: period.baselineMonths.length,
            expensesDelta: delta(summary.expenses, prevTotals?.expenses),
            incomeDelta: delta(summary.income, prevTotals?.income),
            savingsDelta: delta(summary.netSavings, prevTotals?.netSavings),
        },
        projection,
        netWorth: {
            current: currentNetWorth,
            allTimeHigh,
            drawdown,
            drawdownPct,
            series: netWorthSeries,
        },
        monthlySeries,
        paceCurve,
        dailyTotals,
        noSpendDays,
        spendingByCategory,
        incomeBySource,
        movers,
        frequency,
        byWeekday,
        recurring: activeRecurring,
        endedRecurring: recurring.filter((r) => r.status === "ended"),
        fixedMonthlyEstimate,
        anomalies,
        duplicates,
        accountActivity,
        topExpenses,
        dormant,
        firstTime,
        firstTimeTotal,
        sizeDistribution,
        yoy,
        trajectory,
        payday,
        savingsStreak,
        blankDescriptions,
        lastTxDate,
        daysSinceLastTx,
        insights,
        briefing,
        health: { score: healthScore, label: healthLabel, parts: healthParts },
        pacing,
        momentum,
        periodRank,
        burn: { avgMonthlyExpenses, avgMonthlyNet, runwayMonths, coverMonths },
        volatility,
        top3Share,
        fixedShare,
    };
}
