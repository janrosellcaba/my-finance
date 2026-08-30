import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { account, category, todo, transaction, users } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { eq } from "drizzle-orm";

export async function GET() {
    const user = await validateSession();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();

    const [userRecord, userAccounts, userCategories, userTransactions, userTodos] = await Promise.all([
        db
            .select({
                id: users.id,
                username: users.username,
                createdAt: users.createdAt,
                privacyMode: users.privacyMode,
                themePreference: users.themePreference,
                accentColor: users.accentColor,
                currency: users.currency,
                dateFormat: users.dateFormat,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .get(),
        db.select().from(account).where(eq(account.userId, user.id)).all(),
        db.select().from(category).where(eq(category.userId, user.id)).all(),
        db.select().from(transaction).where(eq(transaction.userId, user.id)).all(),
        db.select().from(todo).where(eq(todo.userId, user.id)).all(),
    ]);

    const backupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        user: userRecord,
        accounts: userAccounts,
        categories: userCategories,
        transactions: userTransactions,
        todos: userTodos,
    };

    const json = JSON.stringify(backupPayload, null, 2);
    const filename = `myfinance-backup-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(json, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
