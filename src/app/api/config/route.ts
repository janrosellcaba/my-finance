import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { account, category } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, eq } from "drizzle-orm";

export async function GET() {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = await getDb();

        const userAccounts = await db
            .select()
            .from(account)
            .where(eq(account.userId, user.id))
            .all();

        const userCategories = await db
            .select()
            .from(category)
            .where(eq(category.userId, user.id))
            .all();

        return NextResponse.json({
            success: true,
            accounts: userAccounts,
            categories: userCategories,
        });
    } catch (error) {
        console.error("Config fetch error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
            target?: unknown;
            name?: unknown;
            type?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { target, name, type } = body;

        if (typeof name !== "string" || name.trim().length < 1) {
            return NextResponse.json({ error: "Name is required." }, { status: 400 });
        }

        const db = await getDb();
        const itemId = crypto.randomUUID();

        if (target === "account") {
            await db.insert(account).values({
                id: itemId,
                userId: user.id,
                name: name.trim(),
            });
        } else if (target === "category") {
            if (typeof type !== "string" || !["income", "expense"].includes(type)) {
                return NextResponse.json({ error: "Invalid category type." }, { status: 400 });
            }
            await db.insert(category).values({
                id: itemId,
                userId: user.id,
                name: name.trim(),
                type: type as "income" | "expense",
            });
        } else {
            return NextResponse.json({ error: "Invalid configuration target." }, { status: 400 });
        }

        return NextResponse.json({ success: true, id: itemId }, { status: 201 });
    } catch (error) {
        console.error("Config write error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}