import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { invalidateAllSessions, validateSession } from "@/lib/session";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
            currentPassword?: unknown;
            newPassword?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

        if (newPassword.length < 1) {
            return NextResponse.json({ error: "New password must be at least 1 character." }, { status: 400 });
        }

        const db = await getDb();
        const userRecord = await db.select().from(users).where(eq(users.id, user.id)).get();

        if (!userRecord || !(await verifyPassword(currentPassword, userRecord.passwordHash))) {
            return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
        }

        const passwordHash = await hashPassword(newPassword);
        await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

        await invalidateAllSessions(user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Change password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
