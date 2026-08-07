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

        const body = (await request.json().catch(() => null)) as { theme?: unknown } | null;
        if (!body || (body.theme !== "light" && body.theme !== "dark")) {
            return NextResponse.json({ error: "theme must be 'light' or 'dark'." }, { status: 400 });
        }

        const db = await getDb();
        await db.update(users).set({ themePreference: body.theme }).where(eq(users.id, user.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Theme update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
