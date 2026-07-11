import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { session, users, type User } from "@/db/schema";

const COOKIE_NAME = "finance_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function generateToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function hashToken(token: string): Promise<string> {
    const encodedToken = new TextEncoder().encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encodedToken);

    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const sessionId = await hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const db = await getDb();
    await db.insert(session).values({
        id: sessionId,
        userId,
        expiresAt: expiresAt.getTime(),
    });

    return { token, expiresAt };
}

export async function validateSession(): Promise<User | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const sessionId = await hashToken(token);
    const db = await getDb();

    const result = await db
        .select({ user: users, sessionRecord: session })
        .from(session)
        .innerJoin(users, eq(session.userId, users.id))
        .where(eq(session.id, sessionId))
        .get();

    if (!result) return null;

    if (Date.now() >= result.sessionRecord.expiresAt) {
        await db.delete(session).where(eq(session.id, sessionId));
        return null;
    }

    return result.user;
}

export async function invalidateSession(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return;

    const sessionId = await hashToken(token);
    const db = await getDb();

    await db.delete(session).where(eq(session.id, sessionId));

    cookieStore.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

export async function invalidateAllSessions(userId: string): Promise<void> {
    const db = await getDb();
    await db.delete(session).where(eq(session.userId, userId));

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
    });
}