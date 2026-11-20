import { LANGUAGE_INTL } from "@/i18n";
import type { MarketPeriod } from "./marketsMath";

export type AppLanguage = keyof typeof LANGUAGE_INTL;

/** Trading-terminal palette; fixed (not tied to the app accent) so up/down always read the same. */
export const UP_COLOR = "#15936f";
export const DOWN_COLOR = "#d64545";

export function formatMoney(value: number, currency: string, language: AppLanguage): string {
    const digits = Math.abs(value) >= 1 ? 2 : 4;
    try {
        return new Intl.NumberFormat(LANGUAGE_INTL[language], {
            style: "currency",
            currency,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(value);
    } catch {
        return `${value.toFixed(digits)} ${currency}`;
    }
}

export function formatAxisValue(value: number, language: AppLanguage): string {
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
    return new Intl.NumberFormat(LANGUAGE_INTL[language], {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatAxisDate(iso: string, period: MarketPeriod, language: AppLanguage): string {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const options: Intl.DateTimeFormatOptions =
        period === "1Y" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" };
    return d.toLocaleDateString(LANGUAGE_INTL[language], options);
}
