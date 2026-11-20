import { and, asc, eq, gte, inArray, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { marketAsset, marketPrice, marketSeed, marketSync } from "@/db/schema";
import {
    MARKET_TARGET_CURRENCIES,
    type MarketAssetDTO,
    type MarketAssetType,
    type MarketCandle,
    type MarketPoint,
    type MarketSearchResult,
    type MarketsPayload,
} from "./marketsTypes";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";
const YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";
const USER_AGENT = "Mozilla/5.0 (compatible; MarketsTab/1.0)";
const FETCH_TIMEOUT_MS = 8000;

/** A symbol is refreshed when its last attempt is older than this. */
const CACHE_TTL_MS = 15 * 60 * 1000;
/** After a failed attempt, wait a bit before hitting the provider again. */
const RETRY_AFTER_FAILURE_MS = 2 * 60 * 1000;
/** A manual refresh still skips symbols fetched this recently, so the button can't hammer the provider. */
const FORCE_MIN_INTERVAL_MS = 30 * 1000;
/** How much history is served to the client. */
const HISTORY_DAYS = 370;

export const MAX_ASSETS_PER_USER = 20;
export const SYMBOL_PATTERN = /^[A-Za-z0-9.^=\-]{1,24}$/;

// What every new account starts with: two universally known assets, enough to explain the tab.
export const DEFAULT_ASSETS: { symbol: string; name: string; type: MarketAssetType }[] = [
    { symbol: "^GSPC", name: "S&P 500", type: "index" },
    { symbol: "BTC-EUR", name: "Bitcoin (BTC-EUR)", type: "crypto" },
];

type Db = Awaited<ReturnType<typeof getDb>>;

// --- Provider -----------------------------------------------------------------------------

type ChartResult = {
    currency: string;
    price: number | null;
    priceTime: number | null;
    points: MarketPoint[];
    candles: MarketCandle[];
};

type YahooChartResponse = {
    chart?: {
        result?: {
            meta?: { currency?: string; regularMarketPrice?: number; regularMarketTime?: number; gmtoffset?: number };
            timestamp?: number[];
            indicators?: {
                quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[];
            };
        }[] | null;
    };
};

async function fetchChart(symbol: string): Promise<ChartResult> {
    const url = `${YAHOO_CHART}${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Provider responded ${res.status} for ${symbol}`);

    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    const closes = quote?.close;
    if (!result || !timestamps || !closes) throw new Error(`No data for ${symbol}`);

    let currency = result.meta?.currency ?? "";
    // London listings are quoted in pence ("GBp"/"GBX"): normalise to pounds.
    const scale = currency === "GBp" || currency === "GBX" ? 0.01 : 1;
    if (scale !== 1) currency = "GBP";
    currency = currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Unknown currency for ${symbol}`);

    const offsetSeconds = result.meta?.gmtoffset ?? 0;
    const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
    const byDate = new Map<string, MarketCandle>();
    for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (!isNum(close)) continue;
        const date = new Date((timestamps[i] + offsetSeconds) * 1000).toISOString().slice(0, 10);
        const open = quote?.open?.[i];
        const high = quote?.high?.[i];
        const low = quote?.low?.[i];
        // Days without a full OHLC (providers sometimes omit it) degrade to a flat candle.
        const o = isNum(open) ? open : close;
        const h = isNum(high) ? high : Math.max(o, close);
        const l = isNum(low) ? low : Math.min(o, close);
        byDate.set(date, [date, o * scale, Math.max(h, o, close) * scale, Math.min(l, o, close) * scale, close * scale]);
    }
    const candles = [...byDate.values()].sort((a, b) => a[0].localeCompare(b[0]));
    if (candles.length === 0) throw new Error(`Empty series for ${symbol}`);
    const points = candles.map(([date, , , , close]) => [date, close] as MarketPoint);

    const rawPrice = result.meta?.regularMarketPrice;
    const price = typeof rawPrice === "number" && Number.isFinite(rawPrice) ? rawPrice * scale : points[points.length - 1][1];
    const rawTime = result.meta?.regularMarketTime;
    return { currency, price, priceTime: typeof rawTime === "number" ? rawTime * 1000 : null, points, candles };
}

const SEARCH_TYPES: Record<string, MarketAssetType> = {
    MUTUALFUND: "fund",
    ETF: "etf",
    EQUITY: "stock",
    INDEX: "index",
    CRYPTOCURRENCY: "crypto",
};

export async function searchAssets(query: string): Promise<MarketSearchResult[]> {
    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`;
    const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Search responded ${res.status}`);

    const json = (await res.json()) as {
        quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }[];
    };
    const results: MarketSearchResult[] = [];
    for (const q of json.quotes ?? []) {
        const type = q.quoteType ? SEARCH_TYPES[q.quoteType] : undefined;
        if (!type || !q.symbol || !SYMBOL_PATTERN.test(q.symbol)) continue;
        results.push({
            symbol: q.symbol,
            name: (q.longname || q.shortname || q.symbol).slice(0, 120),
            type,
            exchange: q.exchDisp ?? null,
        });
    }
    return results;
}

// --- Cache / sync -------------------------------------------------------------------------

const inFlight = new Map<string, Promise<boolean>>();

/** Fetches one symbol and stores its closes + latest quote. Never throws; returns success. */
export function syncSymbol(db: Db, symbol: string): Promise<boolean> {
    const running = inFlight.get(symbol);
    if (running) return running;

    const job = (async () => {
        const attemptedAt = Date.now();
        try {
            const data = await fetchChart(symbol);
            db.transaction((tx) => {
                tx.insert(marketPrice)
                    .values(data.candles.map(([date, open, high, low, close]) => ({ symbol, date, open, high, low, close })))
                    .onConflictDoUpdate({
                        target: [marketPrice.symbol, marketPrice.date],
                        set: {
                            close: sql`excluded.close`,
                            open: sql`excluded.open`,
                            high: sql`excluded.high`,
                            low: sql`excluded.low`,
                        },
                    })
                    .run();
                tx.insert(marketSync)
                    .values({
                        symbol,
                        currency: data.currency,
                        price: data.price,
                        priceTime: data.priceTime,
                        fetchedAt: attemptedAt,
                        attemptedAt,
                        ok: true,
                    })
                    .onConflictDoUpdate({
                        target: marketSync.symbol,
                        set: {
                            currency: data.currency,
                            price: data.price,
                            priceTime: data.priceTime,
                            fetchedAt: attemptedAt,
                            attemptedAt,
                            ok: true,
                        },
                    })
                    .run();
            });
            return true;
        } catch (err) {
            console.error(`Market sync failed for ${symbol}:`, err instanceof Error ? err.message : err);
            await db
                .insert(marketSync)
                .values({ symbol, attemptedAt, ok: false })
                .onConflictDoUpdate({ target: marketSync.symbol, set: { attemptedAt, ok: false } });
            return false;
        } finally {
            inFlight.delete(symbol);
        }
    })();

    inFlight.set(symbol, job);
    return job;
}

type SyncRow = typeof marketSync.$inferSelect;

function needsRefresh(row: SyncRow | undefined, now: number, force = false): boolean {
    if (!row) return true;
    if (force) return now - row.attemptedAt > FORCE_MIN_INTERVAL_MS;
    return now - row.attemptedAt > (row.ok ? CACHE_TTL_MS : RETRY_AFTER_FAILURE_MS);
}

function fxSymbol(from: string, to: string): string {
    return `${from}${to}=X`;
}

/** FX pairs needed to show every native currency in the supported target currencies. */
function neededFxPairs(currencies: Iterable<string | null>): { key: string; symbol: string }[] {
    const pairs = new Map<string, string>();
    for (const from of currencies) {
        if (!from) continue;
        for (const to of MARKET_TARGET_CURRENCIES) {
            if (from === to) continue;
            pairs.set(`${from}${to}`, fxSymbol(from, to));
        }
    }
    return [...pairs.entries()].map(([key, symbol]) => ({ key, symbol }));
}

async function loadSync(db: Db, symbols: string[]): Promise<Map<string, SyncRow>> {
    if (symbols.length === 0) return new Map();
    const rows = await db.select().from(marketSync).where(inArray(marketSync.symbol, symbols)).all();
    return new Map(rows.map((r) => [r.symbol, r]));
}

/** Refreshes every stale symbol (assets first, then the FX pairs their currencies need). `force` ignores the 15 min cache window. */
export async function refreshStale(db: Db, userId: string, force = false): Promise<void> {
    const assets = await db.select({ symbol: marketAsset.symbol }).from(marketAsset).where(eq(marketAsset.userId, userId)).all();
    const symbols = [...new Set(assets.map((a) => a.symbol))];
    const now = Date.now();

    const syncMap = await loadSync(db, symbols);
    await Promise.all(symbols.filter((s) => needsRefresh(syncMap.get(s), now, force)).map((s) => syncSymbol(db, s)));

    const afterAssets = await loadSync(db, symbols);
    const pairs = neededFxPairs([...afterAssets.values()].map((r) => r.currency));
    const fxMap = await loadSync(db, pairs.map((p) => p.symbol));
    await Promise.all(pairs.filter((p) => needsRefresh(fxMap.get(p.symbol), now, force)).map((p) => syncSymbol(db, p.symbol)));
}

// --- Watchlist ----------------------------------------------------------------------------

export async function ensureSeeded(db: Db, userId: string): Promise<void> {
    const seeded = await db.select({ userId: marketSeed.userId }).from(marketSeed).where(eq(marketSeed.userId, userId)).get();
    if (seeded) return;

    db.transaction((tx) => {
        const existing = tx.select({ id: marketAsset.id }).from(marketAsset).where(eq(marketAsset.userId, userId)).get();
        if (!existing) {
            tx.insert(marketAsset)
                .values(
                    DEFAULT_ASSETS.map((a, i) => ({
                        id: crypto.randomUUID(),
                        userId,
                        symbol: a.symbol,
                        name: a.name,
                        type: a.type,
                        sortOrder: i,
                    })),
                )
                .run();
        }
        tx.insert(marketSeed).values({ userId }).onConflictDoNothing().run();
    });
}

/** Persists a new watchlist order. Ids that don't belong to the user are ignored. */
export function saveAssetOrder(db: Db, userId: string, ids: string[]): void {
    db.transaction((tx) => {
        ids.forEach((id, index) => {
            tx.update(marketAsset)
                .set({ sortOrder: index })
                .where(and(eq(marketAsset.id, id), eq(marketAsset.userId, userId)))
                .run();
        });
    });
}

export async function nextAssetSortOrder(db: Db, userId: string): Promise<number> {
    const row = await db.select({ m: max(marketAsset.sortOrder) }).from(marketAsset).where(eq(marketAsset.userId, userId)).get();
    return (row?.m ?? -1) + 1;
}

/** Drops cached prices for a symbol once no watchlist references it any more. */
export async function pruneSymbolIfUnused(db: Db, symbol: string): Promise<void> {
    const stillUsed = await db.select({ id: marketAsset.id }).from(marketAsset).where(eq(marketAsset.symbol, symbol)).get();
    if (stillUsed) return;
    await db.delete(marketPrice).where(eq(marketPrice.symbol, symbol));
    await db.delete(marketSync).where(eq(marketSync.symbol, symbol));
}

// --- Payload ------------------------------------------------------------------------------

function cutoffDate(): string {
    return new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function buildPayload(db: Db, userId: string): Promise<MarketsPayload> {
    const assets = await db
        .select()
        .from(marketAsset)
        .where(eq(marketAsset.userId, userId))
        .orderBy(asc(marketAsset.sortOrder), asc(marketAsset.createdAt))
        .all();

    const symbols = [...new Set(assets.map((a) => a.symbol))];
    const syncMap = await loadSync(db, symbols);
    const pairs = neededFxPairs(symbols.map((s) => syncMap.get(s)?.currency ?? null));
    const fxSyncMap = await loadSync(db, pairs.map((p) => p.symbol));

    const priceSymbols = [...symbols, ...pairs.map((p) => p.symbol)];
    const priceRows =
        priceSymbols.length === 0
            ? []
            : await db
                  .select()
                  .from(marketPrice)
                  .where(and(inArray(marketPrice.symbol, priceSymbols), gte(marketPrice.date, cutoffDate())))
                  .orderBy(asc(marketPrice.date))
                  .all();
    const bySymbol = new Map<string, MarketPoint[]>();
    const candlesBySymbol = new Map<string, MarketCandle[]>();
    for (const row of priceRows) {
        const list = bySymbol.get(row.symbol) ?? [];
        list.push([row.date, row.close]);
        bySymbol.set(row.symbol, list);
        if (row.open !== null && row.high !== null && row.low !== null) {
            const candles = candlesBySymbol.get(row.symbol) ?? [];
            candles.push([row.date, row.open, row.high, row.low, row.close]);
            candlesBySymbol.set(row.symbol, candles);
        }
    }

    const now = Date.now();
    const dtos: MarketAssetDTO[] = assets.map((a) => {
        const sync = syncMap.get(a.symbol);
        return {
            id: a.id,
            symbol: a.symbol,
            name: a.name,
            type: a.type,
            currency: sync?.currency ?? null,
            price: sync?.price ?? null,
            priceTime: sync?.priceTime ?? null,
            fetchedAt: sync?.fetchedAt ?? null,
            ok: sync?.ok ?? false,
            history: bySymbol.get(a.symbol) ?? [],
            candles: candlesBySymbol.get(a.symbol) ?? [],
        };
    });

    const fx: Record<string, MarketPoint[]> = {};
    for (const p of pairs) fx[p.key] = bySymbol.get(p.symbol) ?? [];

    // A symbol whose currency is still unknown means its FX needs can't be derived yet.
    const stale =
        symbols.some((s) => needsRefresh(syncMap.get(s), now)) ||
        pairs.some((p) => needsRefresh(fxSyncMap.get(p.symbol), now));

    return { assets: dtos, fx, stale };
}
