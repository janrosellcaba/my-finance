import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction, account } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { applyTransactionToBalances, round2 } from "@/lib/balances";
import { eq, desc } from "drizzle-orm";

export async function GET() {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = await getDb();

        const userAccounts = await db
            .select()
            .from(account)
            .where(eq(account.userId, user.id))
            .all();

        const allTransactions = await db
            .select({
                type: transaction.type,
                amount: transaction.amount,
                accountId: transaction.accountId,
                destinationId: transaction.destinationId,
            })
            .from(transaction)
            .where(eq(transaction.userId, user.id))
            .all();

        const accountBalances: Record<string, { name: string; balance: number }> = {};
        for (const acc of userAccounts) {
            accountBalances[acc.id] = { name: acc.name, balance: 0 };
        }

        let totalNetWorth = 0;

        const rawBalances: Record<string, number> = {};
        for (const accId in accountBalances) rawBalances[accId] = 0;

        for (const tx of allTransactions) {
            applyTransactionToBalances(rawBalances, tx);
        }

        for (const accId in accountBalances) {
            accountBalances[accId].balance = round2(rawBalances[accId]);
            totalNetWorth += accountBalances[accId].balance;
        }
        totalNetWorth = round2(totalNetWorth);

        const recentTransactions = await db
            .select()
            .from(transaction)
            .where(eq(transaction.userId, user.id))
            .orderBy(desc(transaction.date))
            .limit(5)
            .all();

        return NextResponse.json({
            success: true,
            summary: {
                totalNetWorth,
                accounts: Object.entries(accountBalances).map(([id, data]) => ({
                    id,
                    name: data.name,
                    balance: data.balance,
                })),
                recentTransactions,
            },
        });
    } catch (error) {
        console.error("Dashboard calculation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}