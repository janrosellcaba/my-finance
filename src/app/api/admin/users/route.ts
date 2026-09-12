import { NextResponse } from "next/server";
import { desc, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { account, session, transaction, users } from "@/db/schema";
import { isAdminUsername, type AdminUserSummary } from "@/lib/admin";
import { validateSession } from "@/lib/session";

export async function GET() {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!isAdminUsername(user.username)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const db = await getDb();
        const now = Date.now();

        const [userRows, txnStats, accountStats, sessionStats] = await Promise.all([
            db
                .select({
                    id: users.id,
                    username: users.username,
                    createdAt: users.createdAt,
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
                    lastActivity: sql<string>`max(${transaction.createdAt})`.as("lastActivity"),
                })
                .from(transaction)
                .groupBy(transaction.userId)
                .all(),
            db
                .select({
                    userId: account.userId,
                    count: sql<number>`count(*)`.as("count"),
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
        const accountsByUser = new Map(accountStats.map((row) => [row.userId, Number(row.count)]));
        const sessionsByUser = new Map(sessionStats.map((row) => [row.userId, Number(row.count)]));

        const summaries: AdminUserSummary[] = userRows.map((row) => {
            const txn = txnByUser.get(row.id);
            return {
                username: row.username,
                createdAt: row.createdAt,
                language: row.language,
                currency: row.currency,
                transactionCount: Number(txn?.count ?? 0),
                accountCount: accountsByUser.get(row.id) ?? 0,
                lastActivityAt: txn?.lastActivity ?? null,
                activeSessionCount: sessionsByUser.get(row.id) ?? 0,
            };
        });

        return NextResponse.json({ success: true, users: summaries });
    } catch (error) {
        console.error("Admin users fetch error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
