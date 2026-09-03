import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { todo } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, asc, desc, eq, isNull, max, or } from "drizzle-orm";

async function nextSortOrder(
    db: Awaited<ReturnType<typeof getDb>>,
    userId: string,
    parentId: string | null,
) {
    const siblingFilter = parentId
        ? and(eq(todo.userId, userId), eq(todo.parentId, parentId))
        : and(eq(todo.userId, userId), isNull(todo.parentId));
    const row = await db.select({ maxOrder: max(todo.sortOrder) }).from(todo).where(siblingFilter).get();
    return (row?.maxOrder ?? -1) + 1;
}

export async function GET() {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = await getDb();
        const todos = await db
            .select()
            .from(todo)
            .where(eq(todo.userId, user.id))
            .orderBy(asc(todo.completed), asc(todo.sortOrder), desc(todo.createdAt))
            .all();

        return NextResponse.json({ success: true, todos });
    } catch (error) {
        console.error("Todo read error:", error);
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
            id?: unknown;
            text?: unknown;
            dueDate?: unknown;
            parentId?: unknown;
        } | null;
        if (!body || typeof body.text !== "string" || !body.text.trim()) {
            return NextResponse.json({ error: "Text is required." }, { status: 400 });
        }
        if (body.dueDate !== undefined && body.dueDate !== null && typeof body.dueDate !== "string") {
            return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
        }
        if (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== "string") {
            return NextResponse.json({ error: "Invalid parent." }, { status: 400 });
        }

        const db = await getDb();
        const todoId = typeof body.id === "string" && body.id.trim().length > 0 ? body.id.trim() : crypto.randomUUID();
        const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;

        const existing = await db
            .select({ id: todo.id })
            .from(todo)
            .where(and(eq(todo.id, todoId), eq(todo.userId, user.id)))
            .get();

        if (existing) {
            return NextResponse.json({ success: true, todoId, alreadyExisted: true }, { status: 200 });
        }

        if (parentId) {
            const parent = await db
                .select({ id: todo.id, parentId: todo.parentId })
                .from(todo)
                .where(and(eq(todo.id, parentId), eq(todo.userId, user.id)))
                .get();
            if (!parent) {
                return NextResponse.json({ error: "Parent task not found." }, { status: 404 });
            }
            if (parent.parentId) {
                return NextResponse.json({ error: "Subtasks cannot have their own subtasks." }, { status: 400 });
            }
        }

        const sortOrder = await nextSortOrder(db, user.id, parentId);

        await db.insert(todo).values({
            id: todoId,
            userId: user.id,
            text: body.text.trim(),
            dueDate: (body.dueDate as string | null | undefined) || null,
            parentId,
            sortOrder,
        });

        return NextResponse.json({ success: true, todoId }, { status: 201 });
    } catch (error) {
        console.error("Todo write error:", error);
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
            id?: unknown;
            completed?: unknown;
            text?: unknown;
            dueDate?: unknown;
            parentId?: unknown;
            orderedIds?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const db = await getDb();

        if (body.action === "reorder") {
            const { orderedIds, parentId } = body;
            if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
                return NextResponse.json({ error: "orderedIds must be an array of strings." }, { status: 400 });
            }
            if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
                return NextResponse.json({ error: "Invalid parent." }, { status: 400 });
            }
            const ids = orderedIds as string[];
            const scopeParentId = typeof parentId === "string" ? parentId : null;

            db.transaction((tx) => {
                ids.forEach((id, index) => {
                    const scope = scopeParentId
                        ? and(eq(todo.id, id), eq(todo.userId, user.id), eq(todo.parentId, scopeParentId))
                        : and(eq(todo.id, id), eq(todo.userId, user.id), isNull(todo.parentId));
                    tx.update(todo).set({ sortOrder: index }).where(scope).run();
                });
            });

            return NextResponse.json({ success: true });
        }

        if (typeof body.id !== "string") {
            return NextResponse.json({ error: "id is required." }, { status: 400 });
        }

        const updates: {
            completed?: boolean;
            text?: string;
            dueDate?: string | null;
            parentId?: string | null;
        } = {};
        if (typeof body.completed === "boolean") {
            updates.completed = body.completed;
        }
        if (body.text !== undefined) {
            if (typeof body.text !== "string" || !body.text.trim()) {
                return NextResponse.json({ error: "Text is required." }, { status: 400 });
            }
            updates.text = body.text.trim();
        }
        if (body.dueDate !== undefined) {
            if (body.dueDate !== null && typeof body.dueDate !== "string") {
                return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
            }
            updates.dueDate = (body.dueDate as string | null) || null;
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No fields to update." }, { status: 400 });
        }

        const existing = await db
            .select({ id: todo.id, parentId: todo.parentId })
            .from(todo)
            .where(and(eq(todo.id, body.id), eq(todo.userId, user.id)))
            .get();
        if (!existing) {
            return NextResponse.json({ error: "To-do not found." }, { status: 404 });
        }

        await db
            .update(todo)
            .set(updates)
            .where(and(eq(todo.id, body.id), eq(todo.userId, user.id)));

        // Completing a parent completes its subtasks too.
        if (updates.completed === true && !existing.parentId) {
            await db
                .update(todo)
                .set({ completed: true })
                .where(and(eq(todo.parentId, body.id), eq(todo.userId, user.id)));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Todo update error:", error);
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

        const db = await getDb();

        const existing = await db
            .select({ id: todo.id })
            .from(todo)
            .where(and(eq(todo.id, body.id), eq(todo.userId, user.id)))
            .get();
        if (!existing) {
            return NextResponse.json({ error: "To-do not found." }, { status: 404 });
        }

        // Cascade: remove subtasks with the parent.
        await db
            .delete(todo)
            .where(
                and(
                    eq(todo.userId, user.id),
                    or(eq(todo.id, body.id), eq(todo.parentId, body.id)),
                ),
            );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Todo delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
