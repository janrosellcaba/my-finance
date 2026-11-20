import { NextResponse } from "next/server";
import { searchAssets } from "@/lib/markets";
import { validateSession } from "@/lib/session";

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function tooMany(userId: string): boolean {
    const now = Date.now();
    const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
        hits.set(userId, recent);
        return true;
    }
    recent.push(now);
    hits.set(userId, recent);
    if (hits.size > 200) {
        for (const [key, times] of hits) {
            if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
        }
    }
    return false;
}

export async function GET(request: Request) {
    try {
        const user = await validateSession();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
        if (q.length < 2 || q.length > 60) {
            return NextResponse.json({ success: true, results: [] });
        }
        if (tooMany(user.id)) {
            return NextResponse.json({ error: "Too many searches. Try again in a minute." }, { status: 429 });
        }

        const results = await searchAssets(q);
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error("Markets search error:", error);
        return NextResponse.json({ error: "Search unavailable." }, { status: 502 });
    }
}
