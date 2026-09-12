import { NextResponse } from "next/server";
import { desc, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { account, session, transaction, users } from "@/db/schema";
import { type AdminUserSummary } from "@/lib/admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { round2 } from "@/lib/balances";

export async function GET() {
    try {
        const admin = await requireAdmin();
        if (admin instanceof NextResponse) return admin;

        const db = await getDb();
        const now = Date.now();

        const [userRows, txnStats, accountStats, sessionStats] = await Promise.all([
            db
                .select({
                    id: users.id,
                    username: users.username,
                    createdAt: users.createdAt,
                    lastSeenAt: users.lastSeenAt,
                    language: users.language,
                    currency: users.currency,
                })
                .from(users)
                .orderBy(desc(users.createdAt))
                .all(),
            db
                .select({
                    userId: transaction.userId,
                    count: sql<number>`count(*)`.as("count"),
                    delta: sql<number>`coalesce(sum(case when ${transaction.type} = 'income' then ${transaction.amount} when ${transaction.type} = 'expense' then -${transaction.amount} else 0 end), 0)`.as("delta"),
                })
                .from(transaction)
                .groupBy(transaction.userId)
                .all(),
            db
                .select({
                    userId: account.userId,
                    count: sql<number>`count(*)`.as("count"),
                    initial: sql<number>`coalesce(sum(${account.initialBalance}), 0)`.as("initial"),
                })
                .from(account)
                .groupBy(account.userId)
                .all(),
            db
                .select({
                    userId: session.userId,
                    count: sql<number>`count(*)`.as("count"),
                })
                .from(session)
                .where(gt(session.expiresAt, now))
                .groupBy(session.userId)
                .all(),
        ]);

        const txnByUser = new Map(txnStats.map((row) => [row.userId, row]));
        const accountsByUser = new Map(accountStats.map((row) => [row.userId, row]));
        const sessionsByUser = new Map(sessionStats.map((row) => [row.userId, Number(row.count)]));

        const summaries: AdminUserSummary[] = userRows.map((row) => {
            const txn = txnByUser.get(row.id);
            const accounts = accountsByUser.get(row.id);
            return {
                username: row.username,
                createdAt: row.createdAt,
                lastSeenAt: row.lastSeenAt,
                language: row.language,
                currency: row.currency,
                transactionCount: Number(txn?.count ?? 0),
                accountCount: Number(accounts?.count ?? 0),
                balance: round2(Number(accounts?.initial ?? 0) + Number(txn?.delta ?? 0)),
                activeSessionCount: sessionsByUser.get(row.id) ?? 0,
            };
        });

        return NextResponse.json({ success: true, users: summaries });
    } catch (error) {
        console.error("Admin users fetch error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
