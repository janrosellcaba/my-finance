import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { buildPayload, ensureSeeded, refreshStale } from "@/lib/markets";
import { validateSession } from "@/lib/session";

/** Refreshes whatever is older than the cache window, then returns the updated watchlist. */
export async function POST() {
    try {
        const user = await validateSession();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const db = await getDb();
        await ensureSeeded(db, user.id);
        await refreshStale(db, user.id);
        const payload = await buildPayload(db, user.id);
        return NextResponse.json({ success: true, ...payload });
    } catch (error) {
        console.error("Markets refresh error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
