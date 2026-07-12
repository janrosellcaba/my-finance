import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { account, category, transaction } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { CATEGORY_COLOR_PALETTE } from "@/app/shared";

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
            .orderBy(category.sortOrder)
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
            initialBalance?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { target, name, type, initialBalance } = body;

        if (typeof name !== "string" || name.trim().length < 1) {
            return NextResponse.json({ error: "Name is required." }, { status: 400 });
        }

        const db = await getDb();
        const itemId = crypto.randomUUID();

        if (target === "account") {
            let initialBalanceValue = 0;
            if (initialBalance !== undefined) {
                if (typeof initialBalance !== "number" || !Number.isFinite(initialBalance)) {
                    return NextResponse.json({ error: "Invalid initial balance." }, { status: 400 });
                }
                initialBalanceValue = initialBalance;
            }
            await db.insert(account).values({
                id: itemId,
                userId: user.id,
                name: name.trim(),
                initialBalance: initialBalanceValue,
            });
        } else if (target === "category") {
            if (typeof type !== "string" || !["income", "expense"].includes(type)) {
                return NextResponse.json({ error: "Invalid category type." }, { status: 400 });
            }
            const existingOfType = await db
                .select({ id: category.id })
                .from(category)
                .where(and(eq(category.userId, user.id), eq(category.type, type as "income" | "expense")))
                .all();
            await db.insert(category).values({
                id: itemId,
                userId: user.id,
                name: name.trim(),
                type: type as "income" | "expense",
                sortOrder: existingOfType.length,
                color: CATEGORY_COLOR_PALETTE[existingOfType.length % CATEGORY_COLOR_PALETTE.length],
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

export async function DELETE(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as { target?: unknown; id?: unknown } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { target, id } = body;
        if (typeof id !== "string" || id.length < 1) {
            return NextResponse.json({ error: "Id is required." }, { status: 400 });
        }

        const db = await getDb();

        if (target === "account") {
            const existing = await db
                .select()
                .from(account)
                .where(and(eq(account.id, id), eq(account.userId, user.id)))
                .get();
            if (!existing) {
                return NextResponse.json({ error: "Account not found." }, { status: 404 });
            }

            await db.batch([
                db.delete(transaction).where(and(eq(transaction.userId, user.id), eq(transaction.accountId, id))),
                db.delete(transaction).where(and(eq(transaction.userId, user.id), eq(transaction.destinationId, id))),
                db.delete(account).where(and(eq(account.id, id), eq(account.userId, user.id))),
            ]);
        } else if (target === "category") {
            const existing = await db
                .select()
                .from(category)
                .where(and(eq(category.id, id), eq(category.userId, user.id)))
                .get();
            if (!existing) {
                return NextResponse.json({ error: "Category not found." }, { status: 404 });
            }

            await db.batch([
                db.delete(transaction).where(and(eq(transaction.userId, user.id), eq(transaction.destinationId, id))),
                db.delete(category).where(and(eq(category.id, id), eq(category.userId, user.id))),
            ]);
        } else {
            return NextResponse.json({ error: "Invalid configuration target." }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Config delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
            action?: unknown;
            type?: unknown;
            orderedIds?: unknown;
            id?: unknown;
            color?: unknown;
            name?: unknown;
            initialBalance?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { action } = body;
        const db = await getDb();

        if (action === "set-initial-balance") {
            const { id, initialBalance } = body;
            if (typeof id !== "string" || id.length < 1) {
                return NextResponse.json({ error: "Id is required." }, { status: 400 });
            }
            if (typeof initialBalance !== "number" || !Number.isFinite(initialBalance)) {
                return NextResponse.json({ error: "Invalid initial balance." }, { status: 400 });
            }
            const existing = await db
                .select({ id: account.id })
                .from(account)
                .where(and(eq(account.id, id), eq(account.userId, user.id)))
                .get();
            if (!existing) {
                return NextResponse.json({ error: "Account not found." }, { status: 404 });
            }
            await db.update(account).set({ initialBalance }).where(eq(account.id, id));
            return NextResponse.json({ success: true });
        }

        if (action === "rename-account") {
            const { id, name } = body;
            if (typeof id !== "string" || id.length < 1) {
                return NextResponse.json({ error: "Id is required." }, { status: 400 });
            }
            if (typeof name !== "string" || name.trim().length < 1) {
                return NextResponse.json({ error: "Name is required." }, { status: 400 });
            }
            const existing = await db
                .select({ id: account.id })
                .from(account)
                .where(and(eq(account.id, id), eq(account.userId, user.id)))
                .get();
            if (!existing) {
                return NextResponse.json({ error: "Account not found." }, { status: 404 });
            }
            await db.update(account).set({ name: name.trim() }).where(eq(account.id, id));
            return NextResponse.json({ success: true });
        }

        const { type } = body;
        if (typeof type !== "string" || !["income", "expense"].includes(type)) {
            return NextResponse.json({ error: "Invalid category type." }, { status: 400 });
        }
        const categoryType = type as "income" | "expense";

        if (action === "reorder") {
            const { orderedIds } = body;
            if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
                return NextResponse.json({ error: "orderedIds must be an array of strings." }, { status: 400 });
            }
            // D1's bound-parameter limit applies across an entire db.batch() call, so reorder
            // updates are chunked into small groups rather than sent as one big batch.
            const REORDER_CHUNK_SIZE = 15;
            const ids = orderedIds as string[];
            for (let i = 0; i < ids.length; i += REORDER_CHUNK_SIZE) {
                const chunk = ids.slice(i, i + REORDER_CHUNK_SIZE);
                await db.batch(
                    chunk.map((id, chunkIndex) =>
                        db
                            .update(category)
                            .set({ sortOrder: i + chunkIndex })
                            .where(and(eq(category.id, id), eq(category.userId, user.id), eq(category.type, categoryType)))
                    ) as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
                );
            }
        } else if (action === "set-default") {
            const { id } = body;
            if (id !== null && typeof id !== "string") {
                return NextResponse.json({ error: "id must be a string or null." }, { status: 400 });
            }
            if (id) {
                const existing = await db
                    .select({ id: category.id })
                    .from(category)
                    .where(and(eq(category.id, id), eq(category.userId, user.id), eq(category.type, categoryType)))
                    .get();
                if (!existing) {
                    return NextResponse.json({ error: "Category not found." }, { status: 404 });
                }
            }
            await db
                .update(category)
                .set({ isDefault: false })
                .where(and(eq(category.userId, user.id), eq(category.type, categoryType)));
            if (id) {
                await db.update(category).set({ isDefault: true }).where(eq(category.id, id));
            }
        } else if (action === "set-color") {
            const { id, color } = body;
            if (typeof id !== "string" || id.length < 1) {
                return NextResponse.json({ error: "Id is required." }, { status: 400 });
            }
            if (typeof color !== "string" || !CATEGORY_COLOR_PALETTE.includes(color)) {
                return NextResponse.json({ error: "Invalid color." }, { status: 400 });
            }
            const existing = await db
                .select({ id: category.id })
                .from(category)
                .where(and(eq(category.id, id), eq(category.userId, user.id), eq(category.type, categoryType)))
                .get();
            if (!existing) {
                return NextResponse.json({ error: "Category not found." }, { status: 404 });
            }
            await db.update(category).set({ color }).where(eq(category.id, id));
        } else if (action === "rename") {
            const { id, name } = body;
            if (typeof id !== "string" || id.length < 1) {
                return NextResponse.json({ error: "Id is required." }, { status: 400 });
            }
            if (typeof name !== "string" || name.trim().length < 1) {
                return NextResponse.json({ error: "Name is required." }, { status: 400 });
            }
            const existing = await db
                .select({ id: category.id })
                .from(category)
                .where(and(eq(category.id, id), eq(category.userId, user.id), eq(category.type, categoryType)))
                .get();
            if (!existing) {
                return NextResponse.json({ error: "Category not found." }, { status: 404 });
            }
            await db.update(category).set({ name: name.trim() }).where(eq(category.id, id));
        } else {
            return NextResponse.json({ error: "Invalid action." }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Config patch error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}