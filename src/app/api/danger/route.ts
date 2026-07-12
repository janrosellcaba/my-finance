import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { account, transaction, users } from "@/db/schema";
import { invalidateAllSessions, validateSession } from "@/lib/session";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { action } = body;
        const db = await getDb();

        if (action === "delete-transactions") {
            await db.batch([
                db.delete(transaction).where(eq(transaction.userId, user.id)),
                db.update(account).set({ initialBalance: 0 }).where(eq(account.userId, user.id)),
            ]);
        } else if (action === "delete-account") {
            // Transactions are deleted first because transaction.accountId is onDelete: "restrict" —
            // deleting the user row cascades into account/category/session, which would otherwise
            // trip that constraint while transactions still referenced the about-to-vanish accounts.
            await db.batch([
                db.delete(transaction).where(eq(transaction.userId, user.id)),
                db.delete(users).where(eq(users.id, user.id)),
            ]);
            await invalidateAllSessions(user.id);
        } else {
            return NextResponse.json({ error: "Invalid action." }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Danger action error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
