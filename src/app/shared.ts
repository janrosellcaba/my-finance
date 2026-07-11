export type Account = { id: string; name: string };
export type Category = { id: string; name: string; type: "income" | "expense" };

export const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const AMOUNT_MASK = "****";

export function formatCurrency(value: number, privacyMode: boolean): string {
    return privacyMode ? AMOUNT_MASK : eur.format(value);
}

export const INPUT_CLS =
    "w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
