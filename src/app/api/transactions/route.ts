import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, eq, desc, like, gte, lte } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
            date?: unknown;
            description?: unknown;
            type?: unknown;
            amount?: unknown;
            accountId?: unknown;
            destinationId?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { date, description, type, amount, accountId, destinationId } = body;

        if (
            typeof date !== "string" ||
            typeof description !== "string" ||
            typeof amount !== "number" ||
            typeof accountId !== "string" ||
            typeof destinationId !== "string" ||
            typeof type !== "string" ||
            !["income", "expense", "transfer"].includes(type)
        ) {
            return NextResponse.json({ error: "Missing or invalid payload fields." }, { status: 400 });
        }

        const db = await getDb();
        const transactionId = crypto.randomUUID();

        await db.insert(transaction).values({
            id: transactionId,
            userId: user.id,
            date,
            description: description.trim(),
            type: type as "income" | "expense" | "transfer",
            amount,
            accountId,
            destinationId,
        });

        return NextResponse.json({ success: true, transactionId }, { status: 201 });
    } catch (error) {
        console.error("Transaction write error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const searchWord = searchParams.get("search") || "";
        const categoryFilter = searchParams.get("category") || "";
        const startDate = searchParams.get("startDate") || "";
        const endDate = searchParams.get("endDate") || "";

        const LIMIT = 100;
        const OFFSET = (page - 1) * LIMIT;

        const db = await getDb();

        const conditions = [eq(transaction.userId, user.id)];

        if (searchWord) {
            conditions.push(like(transaction.description, `%${searchWord}%`));
        }
        if (categoryFilter) {
            conditions.push(eq(transaction.destinationId, categoryFilter));
        }
        if (startDate) {
            conditions.push(gte(transaction.date, startDate));
        }
        if (endDate) {
            conditions.push(lte(transaction.date, endDate));
        }

        const transactionsList = await db
            .select()
            .from(transaction)
            .where(and(...conditions))
            .orderBy(desc(transaction.date))
            .limit(LIMIT)
            .offset(OFFSET)
            .all();

        return NextResponse.json({
            success: true,
            page,
            limit: LIMIT,
            transactions: transactionsList,
        });
    } catch (error) {
        console.error("Transaction read error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}