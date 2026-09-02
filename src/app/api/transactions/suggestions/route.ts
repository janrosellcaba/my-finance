import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, desc, eq, like, ne } from "drizzle-orm";
import type { DescriptionSuggestion, TransactionType } from "@/app/shared";

const MIN_QUERY = 2;
const MAX_QUERY = 80;
const FETCH_LIMIT = 100;
const RETURN_LIMIT = 8;

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
        const conditions = [eq(transaction.userId, user.id), like(transaction.description, `%${query}%`)];
        if (excludeId) {
            conditions.push(ne(transaction.id, excludeId));
        }

        const rows = await db
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
            .limit(FETCH_LIMIT)
            .all();

        const qLower = query.toLowerCase();
        const seen = new Set<string>();
        const unique: DescriptionSuggestion[] = [];

        for (const row of rows) {
            const description = row.description.trim();
            const key = description.toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            unique.push({
                description,
                type: row.type as TransactionType,
                amount: row.amount,
                accountId: row.accountId,
                destinationId: row.destinationId,
            });
        }

        unique.sort((a, b) => {
            const aPrefix = a.description.toLowerCase().startsWith(qLower) ? 0 : 1;
            const bPrefix = b.description.toLowerCase().startsWith(qLower) ? 0 : 1;
            return aPrefix - bPrefix;
        });

        return NextResponse.json({
            success: true,
            suggestions: unique.slice(0, RETURN_LIMIT),
        });
    } catch (error) {
        console.error("Transaction suggestions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
