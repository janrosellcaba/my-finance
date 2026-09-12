import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { account, category, transaction, users } from "@/db/schema";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyTransactionToBalances, round2 } from "@/lib/balances";

const RECENT_LIMIT = 10;

type RouteContext = { params: Promise<{ username: string }> };

async function findUserByUsername(username: string) {
    const db = await getDb();
    return db
        .select({
            id: users.id,
            username: users.username,
        })
        .from(users)
        .where(eq(users.username, username))
        .get();
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const admin = await requireAdmin();
        if (admin instanceof NextResponse) return admin;

        const { username: rawUsername } = await context.params;
        const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
        if (!username) {
            return NextResponse.json({ error: "Not found." }, { status: 404 });
        }

        const target = await findUserByUsername(username);
        if (!target) {
            return NextResponse.json({ error: "Not found." }, { status: 404 });
        }

        const db = await getDb();
        const [userAccounts, userCategories, recentList, allTx] = await Promise.all([
            db.select().from(account).where(eq(account.userId, target.id)).all(),
            db.select().from(category).where(eq(category.userId, target.id)).all(),
            db
                .select({
                    id: transaction.id,
                    date: transaction.date,
                    description: transaction.description,
                    type: transaction.type,
                    amount: transaction.amount,
                    accountId: transaction.accountId,
                    destinationId: transaction.destinationId,
                    createdAt: transaction.createdAt,
                })
                .from(transaction)
                .where(eq(transaction.userId, target.id))
                .orderBy(desc(transaction.date), desc(transaction.createdAt), desc(transaction.id))
                .limit(RECENT_LIMIT)
                .all(),
            db
                .select({
                    type: transaction.type,
                    amount: transaction.amount,
                    accountId: transaction.accountId,
                    destinationId: transaction.destinationId,
                })
                .from(transaction)
                .where(eq(transaction.userId, target.id))
                .all(),
        ]);

        const running: Record<string, number> = {};
        for (const acc of userAccounts) running[acc.id] = acc.initialBalance;
        for (const tx of allTx) applyTransactionToBalances(running, tx);

        const accountBalances = userAccounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
            icon: acc.icon,
            balance: round2(running[acc.id] ?? acc.initialBalance),
        }));

        return NextResponse.json({
            success: true,
            accounts: userAccounts,
            categories: userCategories,
            recentTransactions: recentList,
            accountBalances,
        });
    } catch (error) {
        console.error("Admin user detail error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    try {
        const admin = await requireAdmin();
        if (admin instanceof NextResponse) return admin;

        const { username: rawUsername } = await context.params;
        const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
        if (!username) {
            return NextResponse.json({ error: "Not found." }, { status: 404 });
        }

        const target = await findUserByUsername(username);
        if (!target) {
            return NextResponse.json({ error: "Not found." }, { status: 404 });
        }

        if (target.id === admin.id) {
            return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
        }

        const db = await getDb();
        // Transactions first: transaction.accountId is onDelete restrict, so the user-row
        // cascade into accounts would fail while those transactions still exist.
        db.transaction((tx) => {
            tx.delete(transaction).where(eq(transaction.userId, target.id)).run();
            tx.delete(users).where(eq(users.id, target.id)).run();
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin user delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
