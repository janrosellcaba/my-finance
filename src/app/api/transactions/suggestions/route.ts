import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, desc, eq, like, ne } from "drizzle-orm";
import type { DescriptionSuggestion, TransactionType } from "@/app/shared";

const MIN_QUERY = 2;
const MAX_QUERY = 80;

export async function GET(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const raw = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
        const query = raw.replace(/[%_]/g, "");
        const excludeId = searchParams.get("exclude")?.trim() ?? "";

        if (query.length < MIN_QUERY) {
            return NextResponse.json({ success: true, suggestions: [] as DescriptionSuggestion[] });
        }

        const db = await getDb();
        const conditions = [eq(transaction.userId, user.id), like(transaction.description, `${query}%`)];
        if (excludeId) {
            conditions.push(ne(transaction.id, excludeId));
        }

        const row = await db
            .select({
                description: transaction.description,
                type: transaction.type,
                amount: transaction.amount,
                accountId: transaction.accountId,
                destinationId: transaction.destinationId,
            })
            .from(transaction)
            .where(and(...conditions))
            .orderBy(desc(transaction.date), desc(transaction.createdAt), desc(transaction.id))
            .limit(1)
            .get();

        const description = row?.description.trim() ?? "";
        const suggestions: DescriptionSuggestion[] = description
            ? [
                  {
                      description,
                      type: row!.type as TransactionType,
                      amount: row!.amount,
                      accountId: row!.accountId,
                      destinationId: row!.destinationId,
                  },
              ]
            : [];

        return NextResponse.json({
            success: true,
            suggestions,
        });
    } catch (error) {
        console.error("Transaction suggestions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
