import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { buildPayload, ensureSeeded } from "@/lib/markets";
import { validateSession } from "@/lib/session";

/** Returns the watchlist from the local cache only (instant, never calls the provider). */
export async function GET() {
    try {
        const user = await validateSession();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const db = await getDb();
        await ensureSeeded(db, user.id);
        const payload = await buildPayload(db, user.id);
        return NextResponse.json({ success: true, ...payload });
    } catch (error) {
        console.error("Markets read error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
