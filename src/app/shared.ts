// Keeps a single import request comfortably under Worker execution limits — each row
// costs its own sequential D1 round trip (see api/import/route.ts), so this bounds worst-case time.
export const MAX_IMPORT_TRANSACTIONS = 2000;

export type Account = { id: string; name: string; initialBalance: number; isDefault: boolean; icon: string | null };
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
    createdAt?: string;
    /** Account balance after this transaction (source account). */
    balanceAfter?: number;
};
export type Delta = { current: number; previous: number; change: number; changePct: number | null };
export type DashboardSummary = {
    totalNetWorth: number;
    netWorthHistory: number[];
    accounts: { id: string; name: string; balance: number; icon: string | null; delta: Delta }[];
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
export type Theme = "light" | "dark";
export type AccentColor = "green" | "blue" | "terracotta" | "slate" | "rose";
export type CurrencyCode = "EUR" | "USD" | "GBP";
export type DateFormat = "DMY" | "MDY" | "YMD";

export const ACCENT_COLORS: { key: AccentColor; label: string; swatch: string }[] = [
    { key: "green", label: "Green", swatch: "#1f7a54" },
    { key: "blue", label: "Blue", swatch: "#2b6cb0" },
    { key: "terracotta", label: "Terracotta", swatch: "#c45c3e" },
    { key: "slate", label: "Slate", swatch: "#4a5568" },
    { key: "rose", label: "Rose", swatch: "#b54a6a" },
];

export const CURRENCY_OPTIONS: { key: CurrencyCode; label: string; symbol: string }[] = [
    { key: "EUR", label: "Euro (€)", symbol: "€" },
    { key: "USD", label: "US Dollar ($)", symbol: "$" },
    { key: "GBP", label: "British Pound (£)", symbol: "£" },
];

export const DATE_FORMAT_OPTIONS: { key: DateFormat; label: string; example: string }[] = [
    { key: "DMY", label: "DD/MM/YYYY", example: "30/08/2026" },
    { key: "MDY", label: "MM/DD/YYYY", example: "08/30/2026" },
    { key: "YMD", label: "YYYY-MM-DD", example: "2026-08-30" },
];

export type AppearancePrefs = {
    theme: Theme;
    privacyMode: boolean;
    accent: AccentColor;
    currency: CurrencyCode;
    dateFormat: DateFormat;
};

export const DEFAULT_APPEARANCE: AppearancePrefs = {
    theme: "light",
    privacyMode: false,
    accent: "green",
    currency: "EUR",
    dateFormat: "DMY",
};

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
    "people",
    "fuel",
    "moto",
    "sport",
    "bizum",
    "bolt",
    "coffee",
    "phone",
    "other",
] as const;
export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

// Curated icon keys offered as the account icon picker — same pattern/rationale as
// CATEGORY_ICON_KEYS, resolved to components in icons.tsx.
export const ACCOUNT_ICON_KEYS = ["bank", "wallet", "card", "cash", "piggybank", "safe"] as const;
export type AccountIconKey = (typeof ACCOUNT_ICON_KEYS)[number];

export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
    EUR: "es-ES",
    USD: "en-US",
    GBP: "en-GB",
};

/** Runtime display prefs — set from AppShell when appearance loads/changes. */
let formatPrefs = {
    currency: DEFAULT_APPEARANCE.currency as CurrencyCode,
    dateFormat: DEFAULT_APPEARANCE.dateFormat as DateFormat,
};

export function setFormatPrefs(prefs: { currency?: CurrencyCode; dateFormat?: DateFormat }) {
    if (prefs.currency) formatPrefs.currency = prefs.currency;
    if (prefs.dateFormat) formatPrefs.dateFormat = prefs.dateFormat;
}

export function getFormatPrefs() {
    return { ...formatPrefs };
}

function currencyFormatter(currency: CurrencyCode = formatPrefs.currency) {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
        style: "currency",
        currency,
        useGrouping: true,
    });
}

/** @deprecated Prefer formatCurrency — kept for call sites that used eur.format */
export const eur = {
    format(value: number) {
        return currencyFormatter().format(value);
    },
};

export const AMOUNT_MASK = "••••••";

export function formatCurrency(value: number, _privacyMode?: boolean): string {
    return currencyFormatter().format(value);
}

export function currencySymbol(currency: CurrencyCode = formatPrefs.currency): string {
    return CURRENCY_OPTIONS.find((c) => c.key === currency)?.symbol ?? "€";
}

export const INPUT_CLS =
    "field-recessed w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export const PRIMARY_BTN =
    "btn-raised rounded-2xl py-4 text-lg font-bold text-white select-none disabled:opacity-60";

export const DANGER_BTN =
    "btn-raised-danger rounded-2xl py-4 text-lg font-bold text-white select-none disabled:opacity-60";

export const INK_BTN =
    "btn-raised-ink rounded-xl px-5 py-3 font-semibold text-paper select-none disabled:opacity-60";

// Dates are stored as "YYYY-MM-DD"; display format follows Appearance → date format.
export function getTodayLocalDateISO(d = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function formatDate(iso: string, format: DateFormat = formatPrefs.dateFormat): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const [, y, mo, d] = m;
    if (format === "MDY") return `${mo}/${d}/${y}`;
    if (format === "YMD") return `${y}-${mo}-${d}`;
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
    const cleaned = raw.replace(/[€$£\s]/g, "");
    if (!cleaned) return null;
    const negative = cleaned.startsWith("-");
    const digits = cleaned.replace(/^-/, "").replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(digits)) return null;
    const value = parseFloat(digits);
    if (Number.isNaN(value)) return null;
    return negative ? -value : value;
}

// Parses a manually typed amount. Both "," and "." are treated as a decimal separator
// (e.g. "17,11" and "17.11" → 17.11). If both appear, the last one is the decimal.
export function parseAmountInput(raw: string): number | null {
    const cleaned = raw.replace(/[€$£\s]/g, "").trim();
    if (!cleaned) return null;
    const negative = cleaned.startsWith("-");
    let digits = cleaned.replace(/^-/, "");
    const lastComma = digits.lastIndexOf(",");
    const lastDot = digits.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
        if (lastComma > lastDot) {
            digits = digits.replace(/\./g, "").replace(",", ".");
        } else {
            digits = digits.replace(/,/g, "");
        }
    } else if (lastComma >= 0) {
        digits = digits.replace(",", ".");
    }
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
