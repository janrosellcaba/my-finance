// Types shared between the Markets API routes and the Markets tab.

export type MarketAssetType = "fund" | "etf" | "stock" | "index" | "crypto";

export type MarketPoint = [date: string, close: number];
export type MarketCandle = [date: string, open: number, high: number, low: number, close: number];

export type MarketAssetDTO = {
    id: string;
    symbol: string;
    name: string;
    type: string;
    /** Native currency of the quote (ISO code), null until the first successful fetch. */
    currency: string | null;
    price: number | null;
    /** Provider timestamp of `price`, in ms since epoch. */
    priceTime: number | null;
    /** Last successful refresh, in ms since epoch. */
    fetchedAt: number | null;
    /** False when the last refresh attempt failed (data may be out of date). */
    ok: boolean;
    /** Daily closes in the asset's native currency, oldest first (about one year). */
    history: MarketPoint[];
    /** Daily OHLC in the native currency, oldest first. Funds publish flat candles (no range). */
    candles: MarketCandle[];
};

export type MarketsPayload = {
    assets: MarketAssetDTO[];
    /** FX series keyed by `${FROM}${TO}` (e.g. "USDEUR"), value = units of TO per 1 FROM. */
    fx: Record<string, MarketPoint[]>;
    /** True when at least one symbol is older than the cache window and should be refreshed. */
    stale: boolean;
};

export type MarketSearchResult = {
    symbol: string;
    name: string;
    type: MarketAssetType;
    exchange: string | null;
};

export const MARKET_TARGET_CURRENCIES = ["EUR", "USD"] as const;
export type MarketCurrency = (typeof MARKET_TARGET_CURRENCIES)[number];
