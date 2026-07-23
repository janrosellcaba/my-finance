import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction, account, category } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { applyTransactionToNetWorth, round2 } from "@/lib/balances";
import { eq } from "drizzle-orm";

type Tx = {
    id: string;
    date: string;
    description: string;
    type: "income" | "expense" | "transfer";
    amount: number;
    accountId: string;
    destinationId: string;
};

function resolveYear(raw: string | null): "all" | string {
    if (raw && /^\d{4}$/.test(raw)) return raw;
    return "all";
}

function resolveMonth(raw: string | null, year: "all" | string): "all" | number {
    if (year === "all") return "all";
    const m = raw ? parseInt(raw, 10) : NaN;
    if (Number.isInteger(m) && m >= 1 && m <= 12) return m;
    return "all";
}

function filterByPeriod(txs: Tx[], year: "all" | string, month: "all" | number): Tx[] {
    if (year === "all") return txs;
    const prefix = month === "all" ? year : `${year}-${String(month).padStart(2, "0")}`;
    return txs.filter((tx) => tx.date.startsWith(prefix));
}

function percent(part: number, total: number): number | null {
    if (total === 0) return null;
    return round2((part / total) * 100);
}

export async function GET(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const year = resolveYear(searchParams.get("year"));
        const month = resolveMonth(searchParams.get("month"), year);

        const db = await getDb();

        const [allTx, userAccounts, userCategories] = await Promise.all([
            db
                .select({
                    id: transaction.id,
                    date: transaction.date,
                    description: transaction.description,
                    type: transaction.type,
                    amount: transaction.amount,
                    accountId: transaction.accountId,
                    destinationId: transaction.destinationId,
                })
                .from(transaction)
                .where(eq(transaction.userId, user.id))
                .all(),
            db.select().from(account).where(eq(account.userId, user.id)).all(),
            db.select().from(category).where(eq(category.userId, user.id)).all(),
        ]);

        const categoryById = new Map(userCategories.map((c) => [c.id, c]));
        const availableYears = Array.from(new Set(allTx.map((tx) => tx.date.slice(0, 4))))
            .sort()
            .reverse();

        const periodTx = filterByPeriod(allTx, year, month);

        const income = round2(
            periodTx.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0)
        );
        const expenses = round2(
            periodTx.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0)
        );
        const netSavings = round2(income - expenses);
        const savingsRate = income === 0 ? null : Math.round((netSavings / income) * 10000) / 10000;

        function categoryBreakdown(type: "income" | "expense") {
            const totals = new Map<string, number>();
            for (const tx of periodTx) {
                if (tx.type !== type) continue;
                const name = categoryById.get(tx.destinationId)?.name ?? "Uncategorised";
                totals.set(name, (totals.get(name) ?? 0) + tx.amount);
            }
            const total = type === "income" ? income : expenses;
            return Array.from(totals.entries())
                .map(([name, amount]) => ({
                    categoryId: name,
                    name,
                    amount: round2(amount),
                    percentOfTotal: percent(amount, total),
                }))
                .sort((a, b) => b.amount - a.amount);
        }

        const topExpenses = periodTx
            .filter((tx) => tx.type === "expense")
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 15)
            .map((tx) => ({
                id: tx.id,
                date: tx.date,
                categoryName: categoryById.get(tx.destinationId)?.name ?? "Uncategorised",
                description: tx.description,
                amount: tx.amount,
            }));

        const accountActivity = userAccounts.map((acc) => {
            let accIncome = 0;
            let accExpenses = 0;
            let transfersIn = 0;
            let transfersOut = 0;
            for (const tx of periodTx) {
                if (tx.type === "income" && tx.accountId === acc.id) accIncome += tx.amount;
                else if (tx.type === "expense" && tx.accountId === acc.id) accExpenses += tx.amount;
                else if (tx.type === "transfer") {
                    if (tx.accountId === acc.id) transfersOut += tx.amount;
                    if (tx.destinationId === acc.id) transfersIn += tx.amount;
                }
            }
            return {
                accountId: acc.id,
                name: acc.name,
                income: round2(accIncome),
                expenses: round2(accExpenses),
                transfersIn: round2(transfersIn),
                transfersOut: round2(transfersOut),
                net: round2(accIncome - accExpenses + transfersIn - transfersOut),
            };
        });

        const sortedAllTx = [...allTx].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
        let running = userAccounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
        const netWorthByDate = new Map<string, number>();
        for (const tx of sortedAllTx) {
            running = applyTransactionToNetWorth(running, tx);
            netWorthByDate.set(tx.date, round2(running));
        }
        const netWorthOverTime = Array.from(netWorthByDate.entries()).map(([date, netWorth]) => ({ date, netWorth }));

        return NextResponse.json({
            success: true,
            availableYears,
            period: { year, month },
            summary: { income, expenses, netSavings, savingsRate },
            spendingByCategory: categoryBreakdown("expense"),
            incomeBySource: categoryBreakdown("income"),
            topExpenses,
            accountActivity,
            netWorthOverTime,
            currentNetWorth: round2(running),
        });
    } catch (error) {
        console.error("Analytics calculation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
