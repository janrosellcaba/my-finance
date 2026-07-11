export type Account = { id: string; name: string };
export type Category = { id: string; name: string; type: "income" | "expense" };

export const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: true });
export const AMOUNT_MASK = "****";

export function formatCurrency(value: number, privacyMode: boolean): string {
    return privacyMode ? AMOUNT_MASK : eur.format(value);
}

export const INPUT_CLS =
    "w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export const PRIMARY_BTN =
    "rounded-2xl py-4 text-lg font-bold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-60 select-none";

export const INK_BTN =
    "rounded-xl bg-ink px-5 py-3 font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-ink/90 hover:shadow-md active:translate-y-0 select-none";

// Dates are stored as "YYYY-MM-DD"; displayed/parsed as "DD/MM/YYYY" everywhere in the app.
export function formatDate(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
}

export function parseDateDDMMYYYY(raw: string): string | null {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3];
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Parses amounts in the app's format, e.g. "-68,99 €" or "1.250,00" (dot thousands, comma decimal).
export function parseAmountEs(raw: string): number | null {
    const cleaned = raw.replace(/[€\s]/g, "");
    if (!cleaned) return null;
    const negative = cleaned.startsWith("-");
    const digits = cleaned.replace(/^-/, "").replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(digits)) return null;
    const value = parseFloat(digits);
    if (Number.isNaN(value)) return null;
    return negative ? -value : value;
}
