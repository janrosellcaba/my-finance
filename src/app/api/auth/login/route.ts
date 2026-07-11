import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
        }

        const db = await getDb();

        const userRecord = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .get();

        const dummyHash = "210000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";
        const isValid = await verifyPassword(
            password,
            userRecord ? userRecord.passwordHash : dummyHash
        );

        if (!userRecord || !isValid) {
            return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
        }

        const { token, expiresAt } = await createSession(userRecord.id);

        await setSessionCookie(token, expiresAt);

        return NextResponse.json({ success: true, userId: userRecord.id });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}