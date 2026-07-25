# Analytics — Phase B execution plan

Target executor: Claude Sonnet, working in this repo with no prior context.
Read this document top to bottom before touching a file. Every section is written so it
can be executed literally.

---

## 0. Context you need before starting

### 0.1 What already exists (uncommitted work in the tree)

| File | Role |
| --- | --- |
| `src/lib/analytics.ts` | **The whole engine.** ~1560 lines, pure functions, zero DB/Next imports. Exports `buildAnalytics()`, `resolvePeriod()`, and all types. |
| `src/app/api/analytics/route.ts` | Thin: fetches `transaction`/`account`/`category` rows for the user, calls `buildAnalytics`, returns `{ success: true, ...result }`. |
| `src/app/components/AnalyticsView.tsx` | Orchestrator: period state, fetch, hero tiles, mobile 5-tab shell + desktop 6-col grid. |
| `src/app/components/analytics/primitives.tsx` | `Section`, `Card`, `DeltaPill`, `StatTile`, `Sparkline`, `InsightCard`, `EmptyNote`. |
| `src/app/components/analytics/panels.tsx` | 12 panels: `MonthlyBars`, `NetWorthChart`, `PaceChart`, `CategoryPanel`, `MoversPanel`, `HeatmapPanel`, `WeekdayPanel`, `FrequencyPanel`, `RecurringPanel`, `AnomaliesPanel`, `AccountsPanel`, `TopExpensesPanel`. |
| `src/app/components/analytics/Briefing.tsx` | Narrative headline/paragraphs/caveats + transparent health score. |
| `src/app/components/analytics/PeriodSelector.tsx` | Mode pills (Month/Year/3M/12M/All) + prev/next + native `<select>`. |

`AnalyticsResult` is declared as `ReturnType<typeof buildAnalytics>`. **Anything you add to
the returned object is automatically typed everywhere downstream.** There is no separate
type file to keep in sync.

### 0.2 Hard constraints (from the user, non-negotiable)

1. **No schema changes.** No new tables, no new columns, no migrations. Everything must be
   derived from existing `transaction` / `account` / `category` rows.
2. **No AI / no model calls.** All narrative text is composed deterministically from
   computed numbers. Never add an API call to an LLM.
3. **No budgets.** Do not add budget-setting, budget targets, or anything the user
   configures as a spending limit. "What your own history says is typical" is allowed;
   "what you told us you want to spend" is not.
4. **Never write to or delete `.dev.vars` or any `.env*` file.** There is a `PreToolUse`
   hook at `.claude/hooks/protect-dotenv.sh` that blocks it. Reading it is fine.
5. **`src/lib/analytics.ts` must stay import-free of DB/Next.** It takes `today` as a
   parameter; do not call `new Date()` for "now" inside it. (`new Date(Date.UTC(...))` for
   calendar arithmetic is already used and is fine — it is deterministic.)

### 0.3 Conventions in the codebase

- Dates are `"YYYY-MM-DD"` strings compared **lexicographically**. Never convert to `Date`
  for comparison — timezone drift will silently shift days in the Worker.
- Money is rounded with `round2()` from `src/lib/balances.ts`.
- Prose money uses the local `money0()` helper in `analytics.ts` (whole euros, `es-ES`
  grouping). Never let a raw negative slip into prose — write "€279 less", not "€-279".
- Every euro figure rendered in a component must respect `privacyMode` (use
  `formatCurrency(v, privacyMode)` from `src/app/shared.ts`, or `AMOUNT_MASK` for axes).
- Indentation is 4 spaces. TypeScript is `strict: true`.
- Typecheck with `./node_modules/.bin/tsc --noEmit`. **Do not run `npx tsc`** — it installs
  a decoy package. `next lint` / `eslint` is broken at HEAD for unrelated reasons; ignore it.

---

## 1. TASK 0 — Simple dashboard by default, "Advanced" button to the new one

The user's words: *"the analytics page at first should be a very simple and easy dashboard
like the one i had before, and an advanced button that moves you to what we are building
now."*

### 1.1 Where the old dashboard lives

The previous simple dashboard is in git at `HEAD`:

```bash
git show HEAD:src/app/components/AnalyticsView.tsx
```

That is your reference for the *simple* view. **Do not copy it verbatim** — it consumed the
old API shape, which no longer exists. Re-implement the same visual result on top of the
current `AnalyticsResult`.

### 1.2 File structure after this task

```
src/app/components/AnalyticsView.tsx                  ← thin shell: fetch + period + view toggle
src/app/components/analytics/SimpleDashboard.tsx      ← NEW: the easy dashboard
src/app/components/analytics/AdvancedDashboard.tsx    ← NEW: everything currently in AnalyticsView's body
```

`AnalyticsView.tsx` keeps: `mode`/`anchor` state, `data`/`loading` state, `fetchData`,
`handlePeriodChange`, the `<h1>`, the in-progress chip, `<PeriodSelector>`, the view toggle,
and then renders one of the two dashboards. **Both dashboards receive `{ data, privacyMode }`.**

Keeping the fetch in the shell means toggling Simple↔Advanced does **not** refetch and does
not change the selected period. That is the intended behaviour.

### 1.3 View state + persistence

```tsx
type View = "simple" | "advanced";

const [view, setView] = useState<View>("simple");

// Read after mount rather than in a lazy initialiser: this component is server-rendered,
// and touching localStorage during render would produce a hydration mismatch.
useEffect(() => {
    if (localStorage.getItem("analytics:view") === "advanced") setView("advanced");
}, []);

function changeView(next: View) {
    setView(next);
    localStorage.setItem("analytics:view", next);
}
```

`localStorage` is used deliberately — persisting this in the DB would be a schema change,
which is forbidden.

### 1.4 The toggle control

Put it on the header row, right of the `<h1>`, before the in-progress chip:

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
    <h1 className="text-2xl font-extrabold text-ink">Analytics</h1>
    <div className="flex items-center gap-2">
        {period.isPartial && (
            <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-muted">
                in progress · day {period.elapsedDays} of {period.totalDays}
            </span>
        )}
        <button
            type="button"
            onClick={() => changeView(view === "simple" ? "advanced" : "simple")}
            className="rounded-xl bg-chip px-4 py-2 text-xs font-bold text-ink transition-colors duration-150 hover:bg-chip-hover select-none"
        >
            {view === "simple" ? "Advanced ›" : "‹ Simple"}
        </button>
    </div>
</div>
```

### 1.5 `SimpleDashboard.tsx` — exact contents

Four things only. Mobile: a 4-tab segmented control (Overview / Categories / Accounts /
Trends), one section visible at a time. Desktop (`lg:`): a 6-column grid showing all of it,
no tab bar. This mirrors the old layout exactly.

**Field mapping from the new `AnalyticsResult`:**

| Old field | New field | Note |
| --- | --- | --- |
| `summary.income` / `.expenses` / `.netSavings` | same | unchanged |
| `summary.savingsRate` | `summary.savingsRate` | ⚠️ **TRAP — see below** |
| `spendingByCategory[].percentOfTotal` | `spendingByCategory[].share` | already a percentage |
| `incomeBySource[].percentOfTotal` | `incomeBySource[].share` | |
| `topExpenses` | `topExpenses` | same shape, now also has `accountName` |
| `accountActivity` | `accountActivity` | same fields, now also `balance` and `share` |
| `netWorthOverTime` | `netWorth.series` | same `{date, netWorth}` points |
| `currentNetWorth` | `netWorth.current` | |
| `availableYears` | `availableYears` | not needed — use `PeriodSelector` |

> ⚠️ **TRAP #1 — savings rate double-scaling.**
> The old code rendered it as `(summary.savingsRate * 100).toFixed(1)`, because the old API
> returned a *fraction*. The new engine returns an already-scaled **percentage**
> (`round2((netSavings / income) * 100)`). Render it as
> `` `${summary.savingsRate.toFixed(1)}%` ``. Multiplying by 100 again would show `4830.0%`.

**Components to build inside `SimpleDashboard.tsx`** (all local to the file — do not export):

- `SummaryCards` — 4 tiles: Income (brand), Expenses (danger), Net Savings
  (brand/danger by sign), Savings Rate (ink, `"—"` when `savingsRate === null`, `AMOUNT_MASK`
  when `privacyMode`). Grid: `grid-cols-2 lg:grid-cols-4`.
  You may reuse `StatTile` from `primitives.tsx` (pass no `delta`, no `sparkline`) — it
  renders the same shape. Prefer that over duplicating a `StatCard`.
- `SimpleCategoryBreakdown` — donut + plain list of `name · amount · share%`.
  Reuse `CategoryPanel` from `panels.tsx`? **No** — it shows sparklines and a
  vs-baseline column, which is the opposite of "simple". Write a local stripped-down
  version: pie (max 8 slices, rest merged into a grey "Other") + a `name / amount / %` list.
  Reuse the `colorFor` idea: category `color` if set, else a stable palette index.
- `SimpleAccountsTable` — 4 columns: Account / Income / Expenses / Net. Note the old table
  showed `income + transfersIn` and `expenses + transfersOut`; keep that.
  ⚠️ At 390px a 4-column table is fine (the 6-column advanced one was not), but still wrap
  it in `overflow-x-auto`.
- `SimpleNetWorthChart` — Recharts `LineChart` over `data.netWorth.series`. If
  `series.length < 2`, render the "not enough history, current net worth is X" note.
  Reuse `NetWorthChart` from `panels.tsx` — it is already exactly this, plus a dashed "peak"
  reference line. The peak line is a nice touch and not complicated; **reuse it.**

**Tab distribution (mobile):**

| Tab | Content |
| --- | --- |
| Overview | `SummaryCards`, then Top 15 largest expenses (`TopExpensesPanel` from `panels.tsx` — reuse) |
| Categories | Spending by category, then Income by source |
| Accounts | `SimpleAccountsTable` |
| Trends | `NetWorthChart` |

**Desktop grid (`hidden lg:grid lg:grid-cols-6 lg:gap-6`):**

```
row 1:  col-span-6   SummaryCards
row 2:  col-span-4   Net Worth Over Time      | col-span-2  Top 15 Largest Expenses (max-h-[320px] overflow-y-auto)
row 3:  col-span-3   Spending by Category     | col-span-3  Income by Source
row 4:  col-span-6   Account Activity
```

### 1.6 Period selector in the simple view

Keep `<PeriodSelector>` in the shell so it applies to both views.

**Decision + rationale:** the old view had two raw `<select>`s (All Years / All Months). The
new `PeriodSelector` is five pills plus one native select — fewer taps, mobile wheel picker,
and it keeps the period consistent when the user toggles to Advanced. It is not more
complex to *use*. If the user objects, reverting is a one-line swap in the shell.

### 1.7 `AdvancedDashboard.tsx`

Move the current body of `AnalyticsView.tsx` — everything from the `hero` const through the
mobile tab shell and the desktop grid — into this new component, unchanged except:

- it takes `{ data, privacyMode }` as props instead of computing `data` itself;
- the `<h1>`, in-progress chip and `<PeriodSelector>` stay behind in the shell;
- `const money = (n: number) => formatCurrency(n, privacyMode);` moves with it;
- the `Tab` type and `TABS` const move with it.

### 1.8 Container width

`src/app/components/AppShell.tsx:109` already widens the container only for the analytics
tab (`max-w-md lg:max-w-6xl`). **Leave it alone** — the old simple dashboard also used a
`lg:grid-cols-6` desktop layout, so the wide container is correct for both views.

### 1.9 Acceptance for Task 0

- Fresh load (no localStorage) → Simple view.
- Toggle to Advanced → reload page → still Advanced.
- Toggling does not trigger a network request (check the Network tab / add a temporary
  `console.count` in `fetchData` and confirm it does not increment).
- Changing the period in Simple, then switching to Advanced, keeps the same period.
- `privacyMode` on → every number in Simple is masked, savings rate included.

---

## 2. Phase B engine work — `src/lib/analytics.ts`

Seven features. Each has an **anchor** telling you where to insert, because line numbers
will shift as you go.

### 2.0 Shared helpers to add first

Put these next to the existing `median` / `mad` / `sum` helpers (§ *statistics helpers*,
around line 95–136):

```ts
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
```

---

### 2.1 — B1: Net-worth trajectory + milestone ETA

**Goal:** *"At your recent pace you'd cross €5,000 around mid-September."*

**Anchor:** insert immediately **after** the `// ---- burn rate & runway ----` block (which
ends with the `coverMonths` const) and **before** `// ---- category momentum ----`.
It depends on `recentComplete`, `avgMonthlyNet` and `currentNetWorth`, all defined above it.

**Types** (add near the other exported types, after `DuplicateGroup`):

```ts
export type Milestone = {
    target: number;
    monthsAway: number;
    etaDate: string;              // "YYYY-MM-DD"
    etaLabel: string;             // "mid September 2026"
    optimisticMonths: number | null;   // using pace + 1 sd
    cautiousMonths: number | null;     // using pace - 1 sd, null if that pace never gets there
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
```

**Algorithm:**

```ts
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
            const monthsAway = monthsTo(target, avgMonthlyNet);
            if (monthsAway === null) return null;
            const etaDate = addDays(today, Math.round(monthsAway * 30.44));
            return {
                target: round2(target),
                monthsAway,
                etaDate,
                etaLabel: vagueDateLabel(etaDate),
                optimisticMonths: monthsTo(target, avgMonthlyNet + sd),
                cautiousMonths: monthsTo(target, avgMonthlyNet - sd),
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
```

**Add to the return object:** `trajectory,`

**Insight** (push inside the insight engine, after the existing `runway` insight):

```ts
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
        advice:
            ms.cautiousMonths !== null && ms.optimisticMonths !== null
                ? `A slower month or two pushes that to about ${ms.cautiousMonths.toFixed(0)} months; a good run gets there in ${ms.optimisticMonths.toFixed(0)}.`
                : undefined,
        score: trajectory.direction === "down" ? 82 : 44,
    });
}
```

> ⚠️ **TRAP #2 — `direction === "flat"`.** When `avgMonthlyNet` is between −25 and +25,
> months-to-target explodes. The `monthsTo` guard (`m <= 36`) handles it, and `flat`
> produces no milestones at all. Do not remove either guard.

---

### 2.2 — B2: Payday-cycle analysis

**Goal:** model the user's dominant income rhythm and describe spending *relative to it*,
e.g. *"You're 12 days into your pay cycle and have spent €340; by this point you're usually
at €280."*

**Anchor:** insert **after** the B1 trajectory block. Depends on `dailyExpense`,
`dailyIncome` (defined ~line 470), `allMonthKeys`, `txs`, `today`.

**Type:**

```ts
export type PaydayBucket = { label: string; avgSpend: number; share: number };

export type PaydayProfile = {
    dayOfMonth: number;
    consistency: number;              // 0–100
    cyclesAnalysed: number;
    avgIncomePerCycle: number;
    avgSpendPerCycle: number;
    buckets: PaydayBucket[];
    frontloadPct: number;             // share of cycle spend in the first 7 days
    // Where you are in the cycle right now
    cycleStart: string;
    daysSincePayday: number;
    daysUntilNextPayday: number;
    spentSincePayday: number;
    typicalSpentByThisPoint: number | null;
};
```

**Algorithm:**

```ts
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
                if (e >= today) continue;      // only complete cycles
                if (s < earliest) continue;    // no data to speak of
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
                    if (starts[i] > today) { nextStart = starts[i]; break; }
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
                    typicalSpentByThisPoint: atSameOffset.length
                        ? round2(sum(atSameOffset) / atSameOffset.length)
                        : null,
                };
            }
        }
    }
}
```

**Add to the return object:** `payday,`

**Insights:**

```ts
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
    if (payday.typicalSpentByThisPoint !== null && payday.typicalSpentByThisPoint > 0) {
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
```

> ⚠️ **TRAP #3 — a monthly-salary user with occasional side income.** Taking the *largest*
> income tx per month is what makes this robust. Do **not** switch to "all income
> transactions" — freelance top-ups and refunds would destroy the median day.
>
> ⚠️ **TRAP #4 — `cycles >= 2` guard.** With one cycle, `typicalSpentByThisPoint` compares
> the user against themselves and always reports 0% difference. Keep the guard.

---

### 2.3 — B3: Dormant-spending detection

**Goal:** categories the user *used* to spend in regularly and has now stopped. Usually good
news worth naming; occasionally a subscription that quietly ended.

**Anchor:** after the B2 payday block.

**Type:**

```ts
export type DormantCategory = {
    categoryId: string;
    name: string;
    lastDate: string;
    monthsSince: number;
    typicalMonthly: number;
    activeMonths: number;
    notSpentSince: number;      // typicalMonthly * monthsSince
};
```

**Algorithm:**

```ts
const dormant: DormantCategory[] = [];
{
    const windowKeys = allMonthKeys.slice(-13);   // 12 complete + the in-progress one
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
```

**Add to the return object:** `dormant,`

**Insight** (cap at 2):

```ts
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
```

> ⚠️ **TRAP #5 — "months since" is computed from days, not month keys.** Using
> `diffDays(last, today) / 30.44` and flooring avoids the classic off-by-one where a
> purchase on the 31st of last month reads as "1 month ago" on the 1st.

---

### 2.4 — B4: First-time purchases

**Goal:** things bought this period that have never appeared in the ledger before.

**Anchor:** after the B3 dormant block.

**Type:**

```ts
export type FirstTime = {
    id: string;
    date: string;
    description: string;
    categoryName: string;
    amount: number;
    isNewCategory: boolean;    // nothing was ever spent in this category before either
};
```

**Algorithm:**

```ts
const firstTime: FirstTime[] = [];
{
    // Meaningless unless there is a "before" to compare against.
    if (earliest < period.start) {
        const floor = Math.max(20, summary.expenses * 0.02);
        const seenDesc = new Set<string>();
        const seenCat = new Set<string>();
        for (const tx of txs) {
            if (tx.type !== "expense") continue;
            if (tx.date >= period.start) break;   // txs is date-sorted
            const norm = tx.description.trim().toLowerCase().replace(/\s+/g, " ");
            if (norm.length >= 3) seenDesc.add(norm);
            seenCat.add(tx.destinationId);
        }
        const claimed = new Set<string>();
        for (const tx of periodTx) {
            if (tx.type !== "expense") continue;
            if (tx.amount < floor) continue;
            const norm = tx.description.trim().toLowerCase().replace(/\s+/g, " ");
            if (norm.length < 3) continue;        // blank descriptions carry no signal
            if (seenDesc.has(norm)) continue;
            if (claimed.has(norm)) continue;      // one entry per merchant, the largest
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
```

> ⚠️ **TRAP #6 — "one entry per merchant, the largest".** `periodTx` is date-sorted, not
> amount-sorted, so the `claimed` set keeps the *first chronologically*, not the largest.
> Either sort a copy of the period's expenses by amount descending before the loop, or
> accept chronological-first and change the comment. **Do the sort** — pick the largest:
> `const periodExpenses = periodTx.filter(t => t.type === "expense").slice().sort((a,b) => b.amount - a.amount);`
> and iterate that instead of `periodTx`.

**Add to the return object:** `firstTime, firstTimeTotal,`

**Insight:**

```ts
if (firstTime.length >= 2) {
    push({
        id: "first-time",
        severity: "info",
        title: `${firstTime.length} things you'd never bought before, ${money(firstTimeTotal)} in total`,
        detail: firstTime.slice(0, 3).map((f) => `${f.description} (${money(f.amount)})`).join(", ") + ".",
        score: 30,
    });
}
```

---

### 2.5 — B5: Transaction-size distribution

**Goal:** answer "is my spending many small things or a few big ones?" — the question that
category breakdowns cannot answer.

**Anchor:** after the B4 first-time block.

**Type:**

```ts
export type SizeBucket = {
    label: string;
    count: number;
    total: number;
    countShare: number;
    spendShare: number;
};

export type SizeDistribution = {
    buckets: SizeBucket[];
    txCount: number;         // expense transactions in the period (NOT summary.txCount)
    topDecileCount: number;  // how many transactions make up the largest 10%
    medianTx: number;
    p90Tx: number;
    top10PctShare: number;   // share of spend from the largest 10% of transactions
    under25Share: number;    // share of spend from transactions below €25
    under25Count: number;
};
```

**Algorithm:**

```ts
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
```

**Add to the return object:** `sizeDistribution,`

**Insights:**

```ts
if (sizeDistribution) {
    const sd = sizeDistribution;
    // sd.topDecileCount, not a fresh calculation from summary.txCount — that one includes
    // income and transfers and would name a different number than the panel shows.
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
```

---

### 2.6 — B6: Rolling 3-month average overlay

**Goal:** a trailing 3-month mean line over the income/expenses bars, so the trend is
visible through lumpy months.

**Anchor:** at the `monthlySeriesFull` → `monthlySeries` slice (currently line ~437).

**Change:** compute the moving average over `monthlySeriesFull` **before** slicing, so the
first visible month still gets a correct MA from earlier history.

```ts
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
```

Everything downstream that reads `monthlySeriesFull` (baselines, `recentComplete`,
`completeMonths`, momentum, trajectory) keeps using `monthlySeriesFull` — **do not** swap
those to the MA version.

**UI change in `panels.tsx` → `MonthlyBars`:**

> ⚠️ **TRAP #7 — `BarChart` cannot host a `Line`.** You must switch to Recharts'
> `ComposedChart`. Add `ComposedChart` to the import list from `"recharts"`; `BarChart` can
> then be removed from the import if nothing else uses it (check first — `grep -n "BarChart"`).

```tsx
<ComposedChart data={data.monthlySeries}>
    {/* …existing XAxis / YAxis / Tooltip / ReferenceLine / two Bars… */}
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
```

Add a one-line caption under the chart inside the `Card`:
`<p className="mt-2 text-xs text-muted">Dashed line: 3-month average of expenses.</p>`

Only overlay **expenses**. Two dashed lines on a two-bar chart is unreadable at 390px;
`incomeMA3` is computed and returned for anyone who wants it later.

---

### 2.7 — B7: Year-over-year (auto-enables once 12 months of history exist)

**Goal:** compare the selected period against the same window one year earlier.

> ⚠️ **TRAP #8 — do not hardcode "October".** The user's note says it auto-enables in
> October only because that is when their own history reaches 12 months. The gate must be
> **`allMonthKeys.length >= 13`**, i.e. purely data-driven.

**Anchor:** after the B5 size-distribution block. Depends on `inRange`, `totalsFor`,
`categoryById`, `spendingByCategory`, `period`.

**Type:**

```ts
export type YoY = {
    label: string;
    start: string;
    end: string;
    truncated: boolean;        // shortened to match an in-progress current period
    partialHistory: boolean;   // your data doesn't cover the whole comparison window
    income: number;
    expenses: number;
    netSavings: number;
    expensesDelta: Delta | null;
    incomeDelta: Delta | null;
    categories: { categoryId: string; name: string; now: number; then: number; changePct: number | null }[];
};
```

**Algorithm:**

```ts
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
            if (t < yEnd) { yEnd = t; truncated = true; }
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
```

**Add to the return object:** `yoy,`

**Insight:**

```ts
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
```

---

## 3. Briefing additions (`src/lib/analytics.ts`, narrative block)

The `briefing` block sits near the end, after the insight sort. Add three sentences, in this
order, **after** the existing "where this sits historically" (`periodRank`) paragraph and
**before** the caveats section.

```ts
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
if (payday && payday.typicalSpentByThisPoint !== null) {
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
```

Add one caveat:

```ts
if (yoy?.partialHistory) {
    briefing.caveats.push(
        `Your records don't reach all the way back through ${yoy.label}, so the year-on-year figure compares against an incomplete window.`
    );
}
```

> ⚠️ **TRAP #9 — prose must never contain a raw negative euro.** `money0(-279)` renders
> `€-279`. Always wrap in `Math.abs()` and carry the direction in the words. The
> verification harness in §5 asserts this.

---

## 4. Phase B UI

### 4.1 New file: `src/app/components/analytics/panelsAdvanced.tsx`

`panels.tsx` is already 670 lines; do not grow it further. New file, same header style:

```tsx
"use client";

import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsResult } from "@/lib/analytics";
import { AMOUNT_MASK, formatCurrency, formatDate } from "../../shared";
import { Card, EmptyNote } from "./primitives";

type A = AnalyticsResult;
```

Copy the `AXIS` / `BRAND` / `DANGER` / `NEUTRAL` colour consts and the local `money` helper
from `panels.tsx` (they are module-private there; duplicating four constants is cleaner than
exporting them).

**Six panels to write:**

| Component | Renders | Empty state |
| --- | --- | --- |
| `TrajectoryPanel` | `ComposedChart` over `data.trajectory.points`: an `Area` between `low` and `high` (see trap below), a solid `Line` on `actual` (brand), a dashed `Line` on `central`. Below it, a milestone list: `€4,000 · mid September 2026 · in ~5 months`. Footer: `trajectory.basis`. | `<EmptyNote>Needs three complete months before a trend can be projected.</EmptyNote>` |
| `PaydayPanel` | Header line: "Paid around the {ordinal} · {consistency}% consistent · {cyclesAnalysed} cycles". A 4-row horizontal bar list of `buckets` (width = `share`%, label + `avgSpend`). Then a "right now" strip: days since payday, spent so far, vs typical. | `<EmptyNote>No clear pay rhythm detected yet — this needs three months with a consistent main income date.</EmptyNote>` |
| `DormantPanel` | List of `data.dormant`: name, "last seen {formatDate(lastDate)}", "{monthsSince} months ago", `typicalMonthly` in muted text. | `<EmptyNote>Nothing you used to buy regularly has gone quiet.</EmptyNote>` |
| `FirstTimePanel` | List of `data.firstTime`: description, category, amount, a small "new category" chip when `isNewCategory`. Footer total. | `<EmptyNote>Nothing new to your history this period.</EmptyNote>` |
| `SizeDistributionPanel` | Bar list over `buckets`: label, bar width = `spendShare`%, right-aligned `total` and a muted `{count}×`. Footer: "Median {medianTx} · top 10% are {p90Tx}+ and make up {top10PctShare}% of spend." | `<EmptyNote>Needs at least eight expenses in the period.</EmptyNote>` |
| `YoYPanel` | Two summary rows (Expenses / Income) with now vs then and a `DeltaPill`. Then a category table: name, now, then, %. A muted footer when `truncated` ("compared against the same number of days") or `partialHistory`. | `<EmptyNote>Year-on-year comparison unlocks once you have twelve months of history.</EmptyNote>` |

> ⚠️ **TRAP #10 — the confidence cone.** Recharts cannot shade *between* two series
> directly. Use two stacked `Area`s: one from 0 to `low` with `fill="none"`/`fillOpacity={0}`,
> and one stacked on top spanning `high - low`. That requires precomputing a `band` value.
> **Simpler and good enough: skip the shaded cone.** Draw `low` and `high` as thin dotted
> lines in `NEUTRAL` alongside the dashed `central`. Do this. If you want the cone later it
> is a separate change.

> ⚠️ **TRAP #11 — privacyMode on every new number.** Each of the six panels renders euro
> figures. Route all of them through `formatCurrency(v, privacyMode)`, and every Y-axis
> `tickFormatter` through `(v) => (privacyMode ? AMOUNT_MASK : String(Math.round(v)))`.
> Percentages and day counts are not sensitive and stay visible.

### 4.2 Placement in `AdvancedDashboard.tsx`

**Mobile — keep five tabs.** A sixth at 390px would leave ~62px per tab with 11px text.
Distribute into the existing tabs:

| Tab | Add |
| --- | --- |
| Overview | *(nothing new — the Briefing already carries the new sentences)* |
| Insights | `<Section title="Gone quiet">` → `DormantPanel`; `<Section title="First time buying">` → `FirstTimePanel` |
| Spending | `<Section title="Your pay cycle">` → `PaydayPanel`; `<Section title="Transaction sizes">` → `SizeDistributionPanel` |
| Trends | `<Section title="Where this is heading" subtitle={data.trajectory?.basis}>` → `TrajectoryPanel` (put it **first** in the tab, above "Income vs expenses"); `<Section title="Versus last year">` → `YoYPanel` (after "Net worth over time") |
| Accounts | *(unchanged)* |

**Desktop grid** — insert these rows into the existing `grid-cols-6`:

```
after the existing "Net worth over time" row:
    col-span-4   Where this is heading   (TrajectoryPanel)
    col-span-2   Versus last year        (YoYPanel)

after the existing "Spending pace / How often you buy" row:
    col-span-3   Your pay cycle          (PaydayPanel)
    col-span-3   Transaction sizes       (SizeDistributionPanel)

after the existing "Unusual & duplicates / Top expenses" row:
    col-span-3   Gone quiet              (DormantPanel)
    col-span-3   First time buying       (FirstTimePanel)
```

Keep `Accounts` (`col-span-6`) last.

### 4.3 Hero tiles

Do **not** add tiles. The hero row is already six across on desktop and two across on
mobile; a seventh breaks the grid. The new figures live in the Briefing and the panels.

---

## 5. Verification protocol — do not skip this

This is the step that caught 12 real bugs in Phase A. Code review alone did not find any of
them. `analytics.ts` is deliberately dependency-free so it can be executed standalone.

### 5.1 Pull a fixture of real data once

`.dev.vars` holds the Cloudflare D1 credentials. **Read it. Never write it.** Query the D1
REST API read-only and cache the result as a JSON fixture in the scratchpad, then iterate
against the fixture so you are not hammering the API:

```
POST https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/d1/database/{CLOUDFLARE_DATABASE_ID}/query
Authorization: Bearer {CLOUDFLARE_D1_TOKEN}
body: { "sql": "SELECT id,date,description,type,amount,account_id,destination_id FROM \"transaction\" WHERE user_id = ?", "params": [userId] }
```

Also pull `account` and `category`. Write the three arrays to
`<scratchpad>/fixture.json`. Map snake_case columns to the camelCase field names
`AnalyticsTx` expects.

### 5.2 Run the engine standalone

Node cannot resolve extensionless TS imports by default. Register a resolve hook:

```js
// <scratchpad>/resolve-ts.mjs
export async function resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        try { return await next(specifier + ".ts", context); } catch { /* fall through */ }
    }
    return next(specifier, context);
}
```

```bash
node --experimental-strip-types --import ./resolve-ts.mjs <scratchpad>/checkb.mts
```

### 5.3 Assertions the harness must make

Run `buildAnalytics` for **six period modes**: two different `month` anchors, `year`, `3m`,
`12m`, `all`. For each, assert:

**Carried over from Phase A (keep these — they are regression guards):**
1. `summary.income` / `expenses` reconcile against an independent sum of the raw rows.
2. Per-account balances reconcile against an independent replay of every transaction.
3. Category totals sum to `summary.expenses`.
4. Weekday totals sum to `summary.expenses`.
5. `frequency` tx counts sum to the period's expense count.
6. `health.score` is `null` or within `0..100`.
7. No `momentum` entry has an all-zero `values` array.
8. `briefing.headline` is non-empty whenever `summary.txCount > 0`.
9. **No string in `briefing.headline`, `briefing.paragraphs`, `briefing.caveats`, or any
   `insight.title`/`detail`/`advice` contains the substring `"€-"`.**

**New for Phase B:**
10. `trajectory === null` **or** `points.length === actualTail + 6`, every projected point
    satisfies `low <= central <= high`, and exactly one point has both `actual !== null` and
    `central !== null` (the junction).
11. Every `milestone.monthsAway` is `> 0` and `<= 36`; `etaDate > today`; `target > currentNetWorth`
    when `direction === "up"`.
12. `payday === null` **or** `1 <= dayOfMonth <= 31`, `consistency` in `0..100`,
    `sum(buckets.share)` is within 0.5 of 100 (or all zero), `cyclesAnalysed >= 2`,
    `0 <= daysSincePayday <= 40`.
13. Every `dormant` entry has `monthsSince >= 2`, `activeMonths >= 3`, `typicalMonthly >= 15`,
    and `lastDate < today`.
14. Every `firstTime` entry's normalised description does **not** appear in any transaction
    dated before `period.start`. **Assert this by brute force against the raw rows** — it is
    the assertion most likely to fail.
15. `sizeDistribution === null` **or** `sum(buckets.count) === ` the period's expense count
    **and** `sum(buckets.spendShare)` is within 0.5 of 100.
16. `monthlySeries[i].expensesMA3` is `null` or equals the mean of the three
    `monthlySeriesFull` expenses ending at that month; it is **always** `null` for the
    in-progress month.
17. `yoy === null` **or** `yoy.start` is exactly 12 months before `period.start`, and
    `yoy.expenses` equals an independent sum of raw rows in `[yoy.start, yoy.end]`.
18. `insights` are sorted by severity rank first (`critical > warn > good > info`), score second.

Print `ALL CHECKS PASSED` with the assertion count, or the first failure with actual vs
expected. **Fix the engine, not the assertion.**

### 5.4 Read the prose out loud

Print `briefing.headline`, every paragraph, every caveat, and every insight
`title`/`detail`/`advice` for all six modes. Then actually read them. Phase A's four worst
bugs were grammatically valid sentences that were nonsense in context — no assertion would
have caught them. Look specifically for:
- advice that is technically true but useless ("you may spend €118/day" when nowhere near the limit);
- sentences asserting a trend from a run of zeros;
- comparisons against a baseline that does not exist;
- "N month(s)" where a real number should be singularised.

### 5.5 Visual check

Start the dev server, sign in as a throwaway user, seed a handful of transactions, and
screenshot at **390×844** and **1440×900**.

> ⚠️ **TRAP #12 — `fullPage: true` does not work in this app.** The scrolling element is an
> inner `<main class="overflow-y-auto">`, not `<body>`. Measure `main`'s `scrollHeight`,
> resize the viewport to it, then take a normal screenshot.

Check: no clipped tables at 390px (the `AccountsPanel` 6-column table needed a stacked-card
fallback for exactly this reason — your new panels must not repeat it), no charts rendering
at zero height, no horizontal body scroll, no empty grid cells without an `EmptyNote`.

### 5.6 Cleanup — mandatory

Delete the throwaway user and all its rows from local D1. Remove every scratch script from
the project root (keep them in the scratchpad). Run `git status --short` and confirm only
intended files appear. Confirm `.dev.vars` is unchanged (`ls -la` it — the byte count should
match what it was at the start).

---

## 6. Execution order

Do these in order. Typecheck (`./node_modules/.bin/tsc --noEmit`) after each numbered step.

1. **Task 0** — Simple/Advanced split. Ship-ready on its own; it is the thing the user will
   see first. Verify §1.9 before moving on.
2. **§2.0** shared helpers.
3. **B6** (rolling average) — smallest engine change, touches `MonthlyBars`. Confirms the
   `ComposedChart` swap works before you depend on it.
4. **B5** (size distribution) — self-contained, no date arithmetic.
5. **B3** (dormant) + **B4** (first-time) — both are single-pass scans over `txs`.
6. **B7** (year-over-year) — reuses existing `inRange`/`totalsFor`.
7. **B1** (trajectory + milestones) — the highest-value feature, and the one with the most
   ways to be subtly wrong.
8. **B2** (payday cycle) — the most complex. Do it last, with the harness already built.
9. **§3** briefing sentences.
10. **§4** UI panels + placement.
11. **§5** full verification, all six modes, both viewports.

Do **not** commit anything unless the user explicitly asks. Nothing in this project has been
committed since `03ab6c0`; the Phase A work is still uncommitted in the working tree.

---

## 7. Explicitly out of scope

- **Phase C** — the user said: *"I don't like phase C, i don't like this calculator."* Do not
  build the "what if I spend €X" simulator, the compare mode, the transfers Sankey, or
  category drill-down unless asked again.
- Budgets, targets, goals the user configures. Forbidden.
- Any schema change or migration.
- Fixing the broken `eslint` config (pre-existing at HEAD, unrelated).
