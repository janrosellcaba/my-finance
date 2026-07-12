import { sql } from "drizzle-orm";
import { sqliteTable, text, real, index, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    privacyMode: integer("privacy_mode", { mode: "boolean" }).notNull().default(false)
});

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    initialBalance: real("initial_balance").notNull().default(0),
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
}, (table) => [
    index("idx_transaction_user_date").on(table.userId, table.date),
    index("idx_transaction_user_category").on(table.userId, table.destinationId),
]);

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
}, (table) => [
    index("idx_session_user").on(table.userId)
]);

export type User = typeof users.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Session = typeof session.$inferSelect;