import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction, account, category } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { buildAnalytics, type PeriodMode } from "@/lib/analytics";
import { eq } from "drizzle-orm";

const MODES: PeriodMode[] = ["month", "year", "3m", "12m", "all"];

function resolveMode(raw: string | null): PeriodMode {
    return MODES.includes(raw as PeriodMode) ? (raw as PeriodMode) : "month";
}

export async function GET(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const mode = resolveMode(searchParams.get("mode"));
        const rawAnchor = searchParams.get("anchor");
        const anchor = rawAnchor && /^\d{4}(-\d{2})?$/.test(rawAnchor) ? rawAnchor : null;

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
                    createdAt: transaction.createdAt,
                })
                .from(transaction)
                .where(eq(transaction.userId, user.id))
                .all(),
            db.select().from(account).where(eq(account.userId, user.id)).all(),
            db.select().from(category).where(eq(category.userId, user.id)).all(),
        ]);

        const result = buildAnalytics({
            txs: allTx,
            accounts: userAccounts,
            categories: userCategories,
            mode,
            anchor,
            today: new Date().toISOString().slice(0, 10),
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("Analytics calculation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
