import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { clearAttempts, isRateLimited, recordFailure } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";

function formatRetryAfter(ms: number): string {
    const minutes = Math.ceil(ms / 60_000);
    return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
}

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

        const rateLimitKey = username.toLowerCase();
        const { limited, retryAfterMs } = isRateLimited(rateLimitKey);
        if (limited) {
            return NextResponse.json(
                { error: `Too many failed attempts. Try again in ${formatRetryAfter(retryAfterMs)}.` },
                { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
            );
        }

        const db = await getDb();

        const userRecord = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .get();

        const dummyHash = "100000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";
        const isValid = await verifyPassword(
            password,
            userRecord ? userRecord.passwordHash : dummyHash
        );

        if (!userRecord || !isValid) {
            recordFailure(rateLimitKey);
            return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
        }

        clearAttempts(rateLimitKey);

        const { token, expiresAt } = await createSession(userRecord.id);

        await setSessionCookie(token, expiresAt);

        return NextResponse.json({ success: true, userId: userRecord.id });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}