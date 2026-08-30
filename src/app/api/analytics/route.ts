import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction, account, category } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { buildAnalytics, type PeriodMode } from "@/lib/analytics";
import { setFormatPrefs, type CurrencyCode } from "@/app/shared";
import { asc, eq } from "drizzle-orm";

const MODES: PeriodMode[] = ["month", "3m", "year", "all"];

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
        const rawAccount = searchParams.get("account");
        const accountId = rawAccount && rawAccount.length > 0 && rawAccount !== "all" ? rawAccount : null;

        const db = await getDb();

        setFormatPrefs({ currency: (user.currency ?? "EUR") as CurrencyCode });

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
                .orderBy(asc(transaction.date), asc(transaction.createdAt), asc(transaction.id))
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
            accountId,
            today: new Date().toISOString().slice(0, 10),
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("Analytics calculation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
