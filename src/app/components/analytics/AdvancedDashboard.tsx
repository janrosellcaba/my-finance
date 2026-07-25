"use client";

import { useState } from "react";
import type { AnalyticsResult } from "@/lib/analytics";
import { formatCurrency } from "../../shared";
import { Briefing } from "./Briefing";
import { InsightCard, Section, StatTile } from "./primitives";
import {
    AccountsPanel,
    AnomaliesPanel,
    CategoryPanel,
    FrequencyPanel,
    HeatmapPanel,
    MonthlyBars,
    MoversPanel,
    NetWorthChart,
    PaceChart,
    RecurringPanel,
    TopExpensesPanel,
    WeekdayPanel,
} from "./panels";
import {
    DormantPanel,
    FirstTimePanel,
    PaydayPanel,
    SizeDistributionPanel,
    TrajectoryPanel,
    YoYPanel,
} from "./panelsAdvanced";

// Shared so the same wording appears once whether a panel is reached via the mobile
// tabs or the desktop grid — the two layouts show the same panels, just arranged differently.
const INFO = {
    whatStandsOut:
        "Automatic findings from this period's numbers — ✓ good, ! worth a look, i for context. Ranked by how much each one matters, not by which has the biggest euro amount.",
    spendingPace:
        "Your cumulative spend this period, day by day, against the dashed line showing what a typical period looked like on the same days. Above the dashed line means you're running hotter than usual.",
    topExpenses: "Your single biggest individual transactions this period, ranked by amount — useful for spotting one-off purchases rather than everyday spending.",
    allFindings: "Every automatic finding for this period, most important first. See 'What stands out' for how the icons and ranking work.",
    unusualDuplicates:
        "Transactions that are unusually large for their category based on your own history, and possible duplicate entries — the same day, amount, description and account appearing more than once.",
    recurringCharges:
        "Charges detected as repeating on a steady interval and amount — subscriptions, rent, and similar. 'Due' means expected any day now; 'overdue' means it's later than usual; 'ended' means it hasn't shown up in a long time and is assumed stopped.",
    goneQuiet: "Categories you used to spend in regularly (at least 3 of the last 12 months) that have gone quiet for 2 months or more.",
    firstTimeBuying: "Purchases this period, over a small threshold, whose description doesn't match anything in your history before this period began.",
    spendingByCategory:
        "How your spending splits across categories this period. The last column compares each category's total against its average over your recent typical months.",
    biggestMovers:
        "Categories whose spending changed the most in raw euros compared to your recent typical months — ranked by size of the change, not by percentage, so a big swing in a big category always shows before a huge percentage swing in a tiny one.",
    howOftenYouBuy:
        "Purchase frequency by category — a way to see small, frequent spending that adds up, separate from which categories have the largest totals.",
    payCycle:
        "Detects the date you're usually paid from your largest income transaction each month, then shows how your spending is typically distributed across the weeks that follow, plus where you are in the current cycle versus past ones.",
    transactionSizes:
        "Groups this period's expenses by size, so you can see whether it was driven by a few big purchases or by lots of small ones.",
    incomeBySource: "How your income splits across sources this period.",
    whereHeading:
        "Projects your net worth forward from your average monthly saving over the last 6 complete months. The dashed line is the central estimate; the thin dotted lines show a faster/slower scenario based on how much that average normally varies month to month.",
    incomeVsExpenses:
        "Monthly income and expense totals side by side. The dashed line is a 3-month moving average of expenses, which smooths out one-off spikes so the underlying trend is easier to see.",
    netWorthOverTime: "The combined balance across all your accounts, tracked day by day. The dashed line marks your all-time high.",
    versusLastYear:
        "Compares this period's income, expenses and top categories against the same window one year ago. Unlocks once you have twelve months of history to compare against.",
    dailySpending: "Each day's total spending — darker means more spent. Useful for spotting patterns like weekend spikes or spending streaks.",
    byDayOfWeek: "Average spend for each weekday, added up across the period, to see whether certain days are consistently more expensive than others.",
    accounts: "Balance, share of your total net worth, and money in and out of each account this period. 'Net' is income minus expenses (and transfers) for that account.",
};

type Tab = "overview" | "insights" | "spending" | "trends" | "accounts";
const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "insights", label: "Insights" },
    { key: "spending", label: "Spending" },
    { key: "trends", label: "Trends" },
    { key: "accounts", label: "Accounts" },
];

export function AdvancedDashboard({ data, privacyMode }: { data: AnalyticsResult; privacyMode: boolean }) {
    const [tab, setTab] = useState<Tab>("overview");

    const { summary, comparison, projection, netWorth, period } = data;
    const money = (n: number) => formatCurrency(n, privacyMode);

    const hero = (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatTile
                label="Net worth"
                value={money(netWorth.current)}
                tone={netWorth.current >= 0 ? "brand" : "danger"}
                privacyMode={privacyMode}
                footnote={netWorth.drawdownPct > 1 ? `${netWorth.drawdownPct.toFixed(0)}% off peak` : "at peak"}
                sparkline={netWorth.series.map((p) => p.netWorth)}
                big
                info="The combined balance of all your accounts right now — every account's starting balance plus every income, expense and transfer since. 'Off peak' shows how far below your all-time high it currently sits."
            />
            <StatTile
                label="Income"
                value={money(summary.income)}
                tone="brand"
                delta={comparison.incomeDelta}
                privacyMode={privacyMode}
            />
            <StatTile
                label="Expenses"
                value={money(summary.expenses)}
                tone="danger"
                delta={comparison.expensesDelta}
                privacyMode={privacyMode}
                goodWhenUp={false}
            />
            <StatTile
                label="Saved"
                value={money(summary.netSavings)}
                tone={summary.netSavings >= 0 ? "brand" : "danger"}
                delta={comparison.savingsDelta}
                privacyMode={privacyMode}
                footnote={summary.savingsRate !== null && !privacyMode ? `${summary.savingsRate.toFixed(0)}% rate` : undefined}
                info="Income minus expenses for this period. The rate underneath is what share of your income that saved amount represents."
            />
            {projection ? (
                <StatTile
                    label="Projected spend"
                    value={money(projection.expenses)}
                    tone="ink"
                    privacyMode={privacyMode}
                    footnote={`day ${period.elapsedDays}/${period.totalDays}`}
                    info="An estimate for the whole period: what you've spent so far, plus what your recent typical months spent on the remaining days of the month specifically — not just a flat daily average, so it doesn't get thrown off by things like salary landing late in the month."
                />
            ) : (
                <StatTile
                    label="Avg expense"
                    value={money(summary.avgExpense)}
                    tone="ink"
                    privacyMode={privacyMode}
                    footnote={`${summary.txCount} transactions`}
                />
            )}
            <StatTile
                label="Fixed / month"
                value={money(data.fixedMonthlyEstimate)}
                tone="ink"
                privacyMode={privacyMode}
                footnote={data.recurring.length > 0 ? `${data.recurring.length} recurring` : "none detected"}
                info="Charges detected as repeating on a steady schedule and amount — subscriptions, rent, and the like. Converted to a monthly figure so weekly or yearly charges are comparable."
            />
        </div>
    );

    const topInsights = data.insights.slice(0, 5);
    const insightFeed =
        data.insights.length === 0 ? (
            <p className="text-sm text-muted">Nothing notable for this period.</p>
        ) : (
            <div className="space-y-2">
                {data.insights.map((i) => (
                    <InsightCard key={i.id} insight={i} />
                ))}
            </div>
        );

    const spendingCats = (
        <CategoryPanel
            title="Spending by category"
            rows={data.spendingByCategory}
            privacyMode={privacyMode}
            tone="danger"
            baselineMonthCount={comparison.baselineMonthCount}
        />
    );
    const incomeCats = (
        <CategoryPanel
            title="Income by source"
            rows={data.incomeBySource}
            privacyMode={privacyMode}
            tone="brand"
            baselineMonthCount={comparison.baselineMonthCount}
        />
    );

    return (
        <>
            {/* ---------- mobile: one section at a time ---------- */}
            <div className="space-y-6 lg:hidden">
                <div className="grid grid-cols-5 gap-1 rounded-xl bg-chip p-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`rounded-lg py-2 text-[11px] font-bold transition-colors duration-150 select-none ${
                                tab === t.key ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "overview" && (
                    <>
                        <Briefing data={data} privacyMode={privacyMode} />
                        {hero}
                        {topInsights.length > 0 && (
                            <Section title="What stands out" info={INFO.whatStandsOut}>
                                <div className="space-y-2">
                                    {topInsights.map((i) => (
                                        <InsightCard key={i.id} insight={i} />
                                    ))}
                                </div>
                            </Section>
                        )}
                        {projection && (
                            <Section title="Spending pace" subtitle={projection.basis} info={INFO.spendingPace}>
                                <PaceChart data={data} privacyMode={privacyMode} />
                            </Section>
                        )}
                        <Section title="Top expenses" info={INFO.topExpenses}>
                            <TopExpensesPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </>
                )}

                {tab === "insights" && (
                    <>
                        <Section title={`All findings (${data.insights.length})`} info={INFO.allFindings}>
                            {insightFeed}
                        </Section>
                        <Section title="Unusual & duplicates" info={INFO.unusualDuplicates}>
                            <AnomaliesPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Recurring charges" info={INFO.recurringCharges}>
                            <RecurringPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Gone quiet" info={INFO.goneQuiet}>
                            <DormantPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="First time buying" info={INFO.firstTimeBuying}>
                            <FirstTimePanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </>
                )}

                {tab === "spending" && (
                    <>
                        <Section title="Spending by category" info={INFO.spendingByCategory}>
                            {spendingCats}
                        </Section>
                        <Section title="Biggest movers" subtitle="Versus your recent typical months" info={INFO.biggestMovers}>
                            <MoversPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="How often you buy" info={INFO.howOftenYouBuy}>
                            <FrequencyPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Your pay cycle" info={INFO.payCycle}>
                            <PaydayPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Transaction sizes" info={INFO.transactionSizes}>
                            <SizeDistributionPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Income by source" info={INFO.incomeBySource}>
                            {incomeCats}
                        </Section>
                    </>
                )}

                {tab === "trends" && (
                    <>
                        <Section title="Where this is heading" subtitle={data.trajectory?.basis} info={INFO.whereHeading}>
                            <TrajectoryPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Income vs expenses" info={INFO.incomeVsExpenses}>
                            <MonthlyBars data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Net worth over time" info={INFO.netWorthOverTime}>
                            <NetWorthChart data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Versus last year" info={INFO.versusLastYear}>
                            <YoYPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Daily spending" subtitle={`${data.noSpendDays} days with no spending`} info={INFO.dailySpending}>
                            <HeatmapPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="By day of week" info={INFO.byDayOfWeek}>
                            <WeekdayPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </>
                )}

                {tab === "accounts" && (
                    <>
                        <Section title="Accounts" info={INFO.accounts}>
                            <AccountsPanel data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Top expenses" info={INFO.topExpenses}>
                            <TopExpensesPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </>
                )}
            </div>

            {/* ---------- desktop: everything at once ---------- */}
            <div className="hidden lg:block lg:space-y-6">
                <Briefing data={data} privacyMode={privacyMode} />
                {hero}

                <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-2">
                        <Section title={`What stands out (${data.insights.length})`} info={INFO.whatStandsOut}>
                            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                                {data.insights.length === 0 ? (
                                    <p className="text-sm text-muted">Nothing notable for this period.</p>
                                ) : (
                                    data.insights.map((i) => <InsightCard key={i.id} insight={i} />)
                                )}
                            </div>
                        </Section>
                    </div>

                    <div className="col-span-4 space-y-6">
                        <Section title="Income vs expenses" info={INFO.incomeVsExpenses}>
                            <MonthlyBars data={data} privacyMode={privacyMode} />
                        </Section>
                        <Section title="Net worth over time" info={INFO.netWorthOverTime}>
                            <NetWorthChart data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-4">
                        <Section title="Where this is heading" subtitle={data.trajectory?.basis} info={INFO.whereHeading}>
                            <TrajectoryPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                    <div className="col-span-2">
                        <Section title="Versus last year" info={INFO.versusLastYear}>
                            <YoYPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-4">
                        <Section title="Spending by category" info={INFO.spendingByCategory}>
                            {spendingCats}
                        </Section>
                    </div>
                    <div className="col-span-2">
                        <Section title="Biggest movers" subtitle="Versus your recent typical months" info={INFO.biggestMovers}>
                            <MoversPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-3">
                        <Section title="Spending pace" subtitle={projection?.basis} info={INFO.spendingPace}>
                            <PaceChart data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                    <div className="col-span-3">
                        <Section title="How often you buy" info={INFO.howOftenYouBuy}>
                            <FrequencyPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-3">
                        <Section title="Your pay cycle" info={INFO.payCycle}>
                            <PaydayPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                    <div className="col-span-3">
                        <Section title="Transaction sizes" info={INFO.transactionSizes}>
                            <SizeDistributionPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-4">
                        <Section title="Daily spending" subtitle={`${data.noSpendDays} days with no spending`} info={INFO.dailySpending}>
                            <HeatmapPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                    <div className="col-span-2">
                        <Section title="By day of week" info={INFO.byDayOfWeek}>
                            <WeekdayPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-3">
                        <Section title="Income by source" info={INFO.incomeBySource}>
                            {incomeCats}
                        </Section>
                    </div>
                    <div className="col-span-3">
                        <Section title="Recurring charges" info={INFO.recurringCharges}>
                            <RecurringPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-3">
                        <Section title="Unusual & duplicates" info={INFO.unusualDuplicates}>
                            <AnomaliesPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                    <div className="col-span-3">
                        <Section title="Top expenses" info={INFO.topExpenses}>
                            <TopExpensesPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-3">
                        <Section title="Gone quiet" info={INFO.goneQuiet}>
                            <DormantPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                    <div className="col-span-3">
                        <Section title="First time buying" info={INFO.firstTimeBuying}>
                            <FirstTimePanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>

                    <div className="col-span-6">
                        <Section title="Accounts" info={INFO.accounts}>
                            <AccountsPanel data={data} privacyMode={privacyMode} />
                        </Section>
                    </div>
                </div>
            </div>
        </>
    );
}
