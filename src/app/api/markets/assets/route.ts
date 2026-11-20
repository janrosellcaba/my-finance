import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { marketAsset } from "@/db/schema";
import {
    MAX_ASSETS_PER_USER,
    SYMBOL_PATTERN,
    ensureSeeded,
    nextAssetSortOrder,
    pruneSymbolIfUnused,
    syncSymbol,
} from "@/lib/markets";
import { validateSession } from "@/lib/session";

const TYPES = new Set(["fund", "etf", "stock", "index", "crypto"]);

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await request.json().catch(() => null)) as { symbol?: unknown; name?: unknown; type?: unknown } | null;
        const symbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
        const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
        const type = typeof body?.type === "string" ? body.type : "";
        if (!SYMBOL_PATTERN.test(symbol) || !name || !TYPES.has(type)) {
            return NextResponse.json({ error: "Invalid asset." }, { status: 400 });
        }

        const db = await getDb();
        await ensureSeeded(db, user.id);

        const mine = await db.select({ symbol: marketAsset.symbol }).from(marketAsset).where(eq(marketAsset.userId, user.id)).all();
        if (mine.some((a) => a.symbol === symbol)) {
            return NextResponse.json({ error: "Already in your watchlist." }, { status: 409 });
        }
        if (mine.length >= MAX_ASSETS_PER_USER) {
            return NextResponse.json({ error: "Watchlist limit reached." }, { status: 400 });
        }

        // Only accept symbols the provider can actually serve data for.
        const ok = await syncSymbol(db, symbol);
        if (!ok) {
            await pruneSymbolIfUnused(db, symbol);
            return NextResponse.json({ error: "No market data available for this asset." }, { status: 422 });
        }

        await db.insert(marketAsset).values({
            id: crypto.randomUUID(),
            userId: user.id,
            symbol,
            name,
            type,
            sortOrder: await nextAssetSortOrder(db, user.id),
        });
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Markets add error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await validateSession();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

        const db = await getDb();
        const asset = await db
            .select({ symbol: marketAsset.symbol })
            .from(marketAsset)
            .where(and(eq(marketAsset.id, id), eq(marketAsset.userId, user.id)))
            .get();
        if (!asset) return NextResponse.json({ error: "Not found." }, { status: 404 });

        await db.delete(marketAsset).where(and(eq(marketAsset.id, id), eq(marketAsset.userId, user.id)));
        await pruneSymbolIfUnused(db, asset.symbol);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Markets delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
