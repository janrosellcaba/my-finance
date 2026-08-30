import { sql } from "drizzle-orm";
import { sqliteTable, text, real, index, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    privacyMode: integer("privacy_mode", { mode: "boolean" }).notNull().default(false),
    themePreference: text("theme_preference").$type<"light" | "dark">().notNull().default("light"),
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

export const todo = sqliteTable("todo", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    dueDate: text("due_date"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
    index("idx_todo_user").on(table.userId)
]);

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
}, (table) => [
    index("idx_session_user").on(table.userId),
    index("idx_session_expires").on(table.expiresAt),
]);

export type User = typeof users.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Todo = typeof todo.$inferSelect;