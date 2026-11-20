import { sql } from "drizzle-orm";
import { sqliteTable, text, real, index, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    privacyMode: integer("privacy_mode", { mode: "boolean" }).notNull().default(false),
    themePreference: text("theme_preference").$type<"light" | "dark">().notNull().default("light"),
    accentColor: text("accent_color").$type<"green" | "blue" | "terracotta" | "slate" | "rose">().notNull().default("green"),
    currency: text("currency").$type<"EUR" | "USD" | "GBP">().notNull().default("EUR"),
    dateFormat: text("date_format").$type<"DMY" | "MDY" | "YMD">().notNull().default("DMY"),
    language: text("language").$type<"en" | "es" | "ca">(),
    lastSeenAt: text("last_seen_at"),
});

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    initialBalance: real("initial_balance").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    icon: text("icon"),
}, (table) => [
    index("idx_account_user").on(table.userId)
]);

export const category = sqliteTable("category", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").$type<"income" | "expense">().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    color: text("color"),
    icon: text("icon"),
}, (table) => [
    index("idx_category_user").on(table.userId)
]);

export const transaction = sqliteTable("transaction", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    description: text("description").notNull(),
    type: text("type").$type<"income" | "expense" | "transfer">().notNull(),
    amount: real("amount").notNull(),

    accountId: text("account_id").notNull().references(() => account.id, { onDelete: "restrict" }),

    destinationId: text("destination_id").notNull(),
    // Insertion time — breaks ties on the same calendar date so entry order is respected
    // (newest-created first in the list). ISO-8601 with ms, e.g. 2026-08-30T14:32:01.123Z.
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (table) => [
    index("idx_transaction_user_date").on(table.userId, table.date),
    index("idx_transaction_user_date_created").on(table.userId, table.date, table.createdAt),
    index("idx_transaction_user_category").on(table.userId, table.destinationId),
    index("idx_transaction_user_account").on(table.userId, table.accountId),
]);

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
}, (table) => [
    index("idx_session_user").on(table.userId),
    index("idx_session_expires").on(table.expiresAt),
]);

// --- Markets tab -----------------------------------------------------------------------
// Per-user watchlist. Price data below is shared across users (it is public market data).
export const marketAsset = sqliteTable("market_asset", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (table) => [
    uniqueIndex("uq_market_asset_user_symbol").on(table.userId, table.symbol),
    index("idx_market_asset_user_sort").on(table.userId, table.sortOrder),
]);

// Daily closes, keyed by provider symbol (also holds FX pairs such as EURUSD=X).
export const marketPrice = sqliteTable("market_price", {
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    close: real("close").notNull(),
    // OHLC for candlesticks. Nullable: rows cached before candles existed have no values
    // until their symbol is refreshed again.
    open: real("open"),
    high: real("high"),
    low: real("low"),
}, (table) => [
    primaryKey({ columns: [table.symbol, table.date] }),
]);

// Latest quote + refresh bookkeeping per symbol (drives the "refresh on visit" cache).
export const marketSync = sqliteTable("market_sync", {
    symbol: text("symbol").primaryKey(),
    currency: text("currency"),
    price: real("price"),
    priceTime: integer("price_time"),
    fetchedAt: integer("fetched_at"),
    attemptedAt: integer("attempted_at").notNull().default(0),
    ok: integer("ok", { mode: "boolean" }).notNull().default(false),
});

// Marks users whose watchlist has already been seeded with the default assets, so that
// removing every asset does not bring the defaults back.
export const marketSeed = sqliteTable("market_seed", {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    seededAt: text("seeded_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type User = typeof users.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Session = typeof session.$inferSelect;
