import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as { privacyMode?: unknown } | null;
        if (!body || typeof body.privacyMode !== "boolean") {
            return NextResponse.json({ error: "privacyMode must be a boolean." }, { status: 400 });
        }

        const db = await getDb();
        await db.update(users).set({ privacyMode: body.privacyMode }).where(eq(users.id, user.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Privacy update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
