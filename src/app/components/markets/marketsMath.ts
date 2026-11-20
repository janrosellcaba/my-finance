import type { MarketAssetDTO, MarketCandle, MarketCurrency, MarketPoint } from "@/lib/marketsTypes";

export type MarketPeriod = "1W" | "1M" | "3M" | "1Y";

export const PERIOD_DAYS: Record<MarketPeriod, number> = { "1W": 7, "1M": 30, "3M": 91, "1Y": 365 };

function isoDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Rate applicable on `date`: the latest one on or before it (first one if none precedes it). */
function rateAt(rates: MarketPoint[], date: string, cursor: { i: number }): number {
    while (cursor.i + 1 < rates.length && rates[cursor.i + 1][0] <= date) cursor.i++;
    return rates[cursor.i][1];
}

export type ConvertedAsset = {
    /** Currency the numbers below are expressed in. */
    currency: string;
    /** False when no FX rate was available, so the native currency is shown instead. */
    converted: boolean;
    /** True for an FX pair such as EUR/USD: the numbers are a rate, not an amount of money. */
    isRate: boolean;
    price: number | null;
    history: MarketPoint[];
    candles: MarketCandle[];
};

export function convertAsset(
    asset: MarketAssetDTO,
    target: MarketCurrency,
    fx: Record<string, MarketPoint[]>,
): ConvertedAsset | null {
    const native = asset.currency;
    if (!native) return null;
    // An exchange rate has no "currency" to convert: show it as is.
    if (asset.type === "currency") {
        return { currency: native, converted: true, isRate: true, price: asset.price, history: asset.history, candles: asset.candles };
    }
    if (native === target) {
        return { currency: native, converted: true, isRate: false, price: asset.price, history: asset.history, candles: asset.candles };
    }
    const rates = fx[`${native}${target}`];
    if (!rates || rates.length === 0) {
        return { currency: native, converted: false, isRate: false, price: asset.price, history: asset.history, candles: asset.candles };
    }
    const cursor = { i: 0 };
    const history = asset.history.map(([date, close]) => [date, close * rateAt(rates, date, cursor)] as MarketPoint);
    const candleCursor = { i: 0 };
    const candles = asset.candles.map(([date, o, h, l, c]) => {
        const r = rateAt(rates, date, candleCursor);
        return [date, o * r, h * r, l * r, c * r] as MarketCandle;
    });
    const latestRate = rates[rates.length - 1][1];
    return {
        currency: target,
        converted: true,
        isRate: false,
        price: asset.price === null ? null : asset.price * latestRate,
        history,
        candles,
    };
}

export type PeriodView = {
    series: MarketPoint[];
    /** Candles inside the window (no baseline point). Empty when the asset has none. */
    candles: MarketCandle[];
    /** True when candles carry real high/low ranges (false for funds, which publish one price a day). */
    hasRange: boolean;
    changePct: number | null;
    low: number | null;
    high: number | null;
};

export function periodView(
    history: MarketPoint[],
    price: number | null,
    period: MarketPeriod,
    allCandles: MarketCandle[] = [],
): PeriodView {
    const empty: PeriodView = { series: [], candles: [], hasRange: false, changePct: null, low: null, high: null };
    const cutoff = isoDaysAgo(PERIOD_DAYS[period]);
    const firstInWindow = history.findIndex(([date]) => date >= cutoff);
    if (firstInWindow === -1) return empty;

    // Keep the last point before the window as the baseline so the change covers the whole period.
    const series = history.slice(Math.max(0, firstInWindow - 1));
    if (series.length < 2) return empty;

    const candles = allCandles.filter(([date]) => date >= cutoff);
    const hasRange = candles.length >= 2 && candles.some(([, , h, l]) => h > l);

    const base = series[0][1];
    const current = price ?? series[series.length - 1][1];
    const closes = series.map(([, v]) => v);
    return {
        series,
        candles,
        hasRange,
        changePct: base > 0 ? ((current - base) / base) * 100 : null,
        low: hasRange ? Math.min(...candles.map(([, , , l]) => l)) : Math.min(...closes),
        high: hasRange ? Math.max(...candles.map(([, , h]) => h)) : Math.max(...closes),
    };
}
