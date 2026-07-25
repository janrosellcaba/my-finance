import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transaction } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, eq, desc, like, gte, lte, lt, or } from "drizzle-orm";

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

export async function PUT(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
            id?: unknown;
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

        const { id, date, description, type, amount, accountId, destinationId } = body;

        if (
            typeof id !== "string" ||
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

        const existing = await db
            .select({ id: transaction.id })
            .from(transaction)
            .where(and(eq(transaction.id, id), eq(transaction.userId, user.id)))
            .get();
        if (!existing) {
            return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
        }

        await db
            .update(transaction)
            .set({
                date,
                description: description.trim(),
                type: type as "income" | "expense" | "transfer",
                amount,
                accountId,
                destinationId,
            })
            .where(and(eq(transaction.id, id), eq(transaction.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Transaction update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
        if (!body || typeof body.id !== "string" || body.id.length < 1) {
            return NextResponse.json({ error: "Id is required." }, { status: 400 });
        }

        const { id } = body;
        const db = await getDb();

        const existing = await db
            .select({ id: transaction.id })
            .from(transaction)
            .where(and(eq(transaction.id, id), eq(transaction.userId, user.id)))
            .get();
        if (!existing) {
            return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
        }

        await db.delete(transaction).where(and(eq(transaction.id, id), eq(transaction.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Transaction delete error:", error);
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
        const searchWord = searchParams.get("search") || "";
        const categoryFilter = searchParams.get("category") || "";
        const startDate = searchParams.get("startDate") || "";
        const endDate = searchParams.get("endDate") || "";
        const cursorDate = searchParams.get("cursorDate") || "";
        const cursorId = searchParams.get("cursorId") || "";

        const LIMIT = 50;

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
        if (cursorDate && cursorId) {
            // Keyset pagination: fetch strictly-older rows than the last one seen, using the
            // (userId, date) index instead of an OFFSET that would re-scan every skipped row.
            conditions.push(
                or(
                    lt(transaction.date, cursorDate),
                    and(eq(transaction.date, cursorDate), lt(transaction.id, cursorId))
                )!
            );
        }

        const transactionsList = await db
            .select()
            .from(transaction)
            .where(and(...conditions))
            .orderBy(desc(transaction.date), desc(transaction.id))
            .limit(LIMIT)
            .all();

        const last = transactionsList[transactionsList.length - 1];
        const nextCursor =
            transactionsList.length === LIMIT && last ? { date: last.date, id: last.id } : null;

        return NextResponse.json({
            success: true,
            limit: LIMIT,
            transactions: transactionsList,
            nextCursor,
        });
    } catch (error) {
        console.error("Transaction read error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}