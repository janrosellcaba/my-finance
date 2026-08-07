// Keeps a single import request comfortably under Worker execution limits — each row
// costs its own sequential D1 round trip (see api/import/route.ts), so this bounds worst-case time.
export const MAX_IMPORT_TRANSACTIONS = 2000;

export type Account = { id: string; name: string; initialBalance: number; isDefault: boolean };
export type Category = {
    id: string;
    name: string;
    type: "income" | "expense";
    sortOrder: number;
    isDefault: boolean;
    color: string | null;
    icon: string | null;
};

export type TransactionType = "income" | "expense" | "transfer";
export type Transaction = {
    id: string;
    date: string;
    description: string;
    type: TransactionType;
    amount: number;
    accountId: string;
    destinationId: string;
};
export type DashboardSummary = {
    totalNetWorth: number;
    accounts: { id: string; name: string; balance: number }[];
    recentTransactions: Transaction[];
};
export type Todo = {
    id: string;
    text: string;
    dueDate: string | null;
    completed: boolean;
    createdAt: string;
};
export type Tab = "home" | "transactions" | "todo" | "analytics" | "config";

// 20 evenly-spaced light pastel colors, offered as the category color picker palette.
export const CATEGORY_COLOR_PALETTE = [
    "#f3bfbf",
    "#f3cebf",
    "#f3debf",
    "#f3eebf",
    "#e8f3bf",
    "#d9f3bf",
    "#c9f3bf",
    "#bff3c4",
    "#bff3d4",
    "#bff3e3",
    "#bff3f3",
    "#bfe3f3",
    "#bfd4f3",
    "#bfc4f3",
    "#c9bff3",
    "#d9bff3",
    "#e8bff3",
    "#f3bfee",
    "#f3bfde",
    "#f3bfce",
];

// Curated icon keys offered as the category icon picker — resolved to actual icon
// components in icons.tsx (kept separate so this file stays framework-agnostic).
export const CATEGORY_ICON_KEYS = [
    "food",
    "transport",
    "shopping",
    "services",
    "salary",
    "investments",
    "gift",
    "home",
    "health",
    "entertainment",
    "travel",
    "education",
] as const;
export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

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

// A CSV import row with this exact category name (as Income) adds to the account's initial
// balance instead of becoming a normal transaction/category. Shared by ImportView.tsx (client
// preview) and api/import/route.ts (server) so the two can't drift out of sync.
export const INITIAL_BALANCE_CATEGORY = "initial balance";

export function isInitialBalanceRow(type: string, categoryName: string): boolean {
    return type === "income" && categoryName.trim().toLowerCase() === INITIAL_BALANCE_CATEGORY;
}
