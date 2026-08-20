import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { todo } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, eq, asc, desc } from "drizzle-orm";

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
            .orderBy(asc(todo.completed), desc(todo.createdAt))
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

        const body = (await request.json().catch(() => null)) as { id?: unknown; text?: unknown; dueDate?: unknown } | null;
        if (!body || typeof body.text !== "string" || !body.text.trim()) {
            return NextResponse.json({ error: "Text is required." }, { status: 400 });
        }
        if (body.dueDate !== undefined && body.dueDate !== null && typeof body.dueDate !== "string") {
            return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
        }

        const db = await getDb();
        const todoId = typeof body.id === "string" && body.id.trim().length > 0 ? body.id.trim() : crypto.randomUUID();

        const existing = await db
            .select({ id: todo.id })
            .from(todo)
            .where(and(eq(todo.id, todoId), eq(todo.userId, user.id)))
            .get();

        if (existing) {
            return NextResponse.json({ success: true, todoId, alreadyExisted: true }, { status: 200 });
        }

        await db.insert(todo).values({
            id: todoId,
            userId: user.id,
            text: body.text.trim(),
            dueDate: (body.dueDate as string | null | undefined) || null,
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

        const body = (await request.json().catch(() => null)) as { id?: unknown; completed?: unknown } | null;
        if (!body || typeof body.id !== "string" || typeof body.completed !== "boolean") {
            return NextResponse.json({ error: "id and completed are required." }, { status: 400 });
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

        await db
            .update(todo)
            .set({ completed: body.completed })
            .where(and(eq(todo.id, body.id), eq(todo.userId, user.id)));

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

        await db.delete(todo).where(and(eq(todo.id, body.id), eq(todo.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Todo delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
