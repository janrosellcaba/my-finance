import type { MarketAssetDTO, MarketCurrency, MarketPoint } from "@/lib/marketsTypes";

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
    price: number | null;
    history: MarketPoint[];
};

export function convertAsset(
    asset: MarketAssetDTO,
    target: MarketCurrency,
    fx: Record<string, MarketPoint[]>,
): ConvertedAsset | null {
    const native = asset.currency;
    if (!native) return null;
    if (native === target) {
        return { currency: native, converted: true, price: asset.price, history: asset.history };
    }
    const rates = fx[`${native}${target}`];
    if (!rates || rates.length === 0) {
        return { currency: native, converted: false, price: asset.price, history: asset.history };
    }
    const cursor = { i: 0 };
    const history = asset.history.map(([date, close]) => [date, close * rateAt(rates, date, cursor)] as MarketPoint);
    const latestRate = rates[rates.length - 1][1];
    return {
        currency: target,
        converted: true,
        price: asset.price === null ? null : asset.price * latestRate,
        history,
    };
}

export type PeriodView = {
    series: MarketPoint[];
    changePct: number | null;
    low: number | null;
    high: number | null;
};

export function periodView(history: MarketPoint[], price: number | null, period: MarketPeriod): PeriodView {
    const cutoff = isoDaysAgo(PERIOD_DAYS[period]);
    const firstInWindow = history.findIndex(([date]) => date >= cutoff);
    if (firstInWindow === -1) return { series: [], changePct: null, low: null, high: null };

    // Keep the last point before the window as the baseline so the change covers the whole period.
    const series = history.slice(Math.max(0, firstInWindow - 1));
    if (series.length < 2) return { series: [], changePct: null, low: null, high: null };

    const base = series[0][1];
    const current = price ?? series[series.length - 1][1];
    const closes = series.map(([, v]) => v);
    return {
        series,
        changePct: base > 0 ? ((current - base) / base) * 100 : null,
        low: Math.min(...closes),
        high: Math.max(...closes),
    };
}
