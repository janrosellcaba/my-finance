import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction, account } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { applyTransactionToBalances, round2 } from "@/lib/balances";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

// How much history the home screen's net-worth sparkline and account "% change"
// badges look back over. Kept short — this is an at-a-glance widget, not analytics.
const HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDaysISO(iso: string, n: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return round2(((current - previous) / Math.abs(previous)) * 100);
}

export async function GET() {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = await getDb();
        const today = new Date().toISOString().slice(0, 10);
        const startDate = addDaysISO(today, -(HISTORY_DAYS - 1));

        const [userAccounts, preWindowSourceDeltas, preWindowTransferInDeltas, windowTransactions] = await Promise.all([
            db
                .select()
                .from(account)
                .where(eq(account.userId, user.id))
                .all(),
            // Fast indexed SQL aggregation for transactions older than the 30-day window
            db
                .select({
                    accountId: transaction.accountId,
                    delta: sql<number>`SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE -${transaction.amount} END)`.as("delta"),
                })
                .from(transaction)
                .where(and(eq(transaction.userId, user.id), lt(transaction.date, startDate)))
                .groupBy(transaction.accountId)
                .all(),
            // Incoming transfer legs older than the 30-day window
            db
                .select({
                    accountId: transaction.destinationId,
                    delta: sql<number>`SUM(${transaction.amount})`.as("delta"),
                })
                .from(transaction)
                .where(
                    and(
                        eq(transaction.userId, user.id),
                        eq(transaction.type, "transfer"),
                        lt(transaction.date, startDate)
                    )
                )
                .groupBy(transaction.destinationId)
                .all(),
            // Only stream the active 30-day window transactions into Node memory
            db
                .select({
                    date: transaction.date,
                    type: transaction.type,
                    amount: transaction.amount,
                    accountId: transaction.accountId,
                    destinationId: transaction.destinationId,
                })
                .from(transaction)
                .where(and(eq(transaction.userId, user.id), gte(transaction.date, startDate)))
                .orderBy(asc(transaction.date), asc(transaction.createdAt), asc(transaction.id))
                .all(),
        ]);

        const runningBalances: Record<string, number> = {};
        for (const acc of userAccounts) runningBalances[acc.id] = acc.initialBalance;

        for (const row of preWindowSourceDeltas) {
            if (row.accountId in runningBalances && row.delta != null) {
                runningBalances[row.accountId] = round2(runningBalances[row.accountId] + row.delta);
            }
        }
        for (const row of preWindowTransferInDeltas) {
            if (row.accountId in runningBalances && row.delta != null) {
                runningBalances[row.accountId] = round2(runningBalances[row.accountId] + row.delta);
            }
        }

        const byDate = new Map<string, typeof windowTransactions>();
        for (const tx of windowTransactions) {
            const key = tx.date > today ? today : tx.date;
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key)!.push(tx);
        }

        const perAccountHistory: Record<string, number[]> = {};
        for (const acc of userAccounts) perAccountHistory[acc.id] = [];
        const netWorthHistory: number[] = [];

        for (let d = startDate; d <= today; d = addDaysISO(d, 1)) {
            for (const tx of byDate.get(d) ?? []) applyTransactionToBalances(runningBalances, tx);
            let total = 0;
            for (const acc of userAccounts) {
                const balance = round2(runningBalances[acc.id]);
                perAccountHistory[acc.id].push(balance);
                total += balance;
            }
            netWorthHistory.push(round2(total));
        }

        const totalNetWorth = netWorthHistory[netWorthHistory.length - 1] ?? 0;

        const recentTransactions = await db
            .select()
            .from(transaction)
            .where(eq(transaction.userId, user.id))
            .orderBy(desc(transaction.date), desc(transaction.createdAt), desc(transaction.id))
            .limit(5)
            .all();

        return NextResponse.json({
            success: true,
            summary: {
                totalNetWorth,
                netWorthHistory,
                accounts: userAccounts.map((acc) => {
                    const history = perAccountHistory[acc.id];
                    const current = history[history.length - 1] ?? acc.initialBalance;
                    const previous = history[0] ?? acc.initialBalance;
                    return {
                        id: acc.id,
                        name: acc.name,
                        balance: current,
                        icon: acc.icon,
                        delta: { current, previous, change: round2(current - previous), changePct: pctChange(current, previous) },
                    };
                }),
                recentTransactions,
            },
        });
    } catch (error) {
        console.error("Dashboard calculation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}