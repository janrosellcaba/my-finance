import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
}
if (!path.isAbsolute(databaseUrl)) {
    throw new Error(`DATABASE_URL must be an absolute path, got: "${databaseUrl}"`);
}

const sqlite = new Database(databaseUrl, { timeout: 5000 });
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("temp_store = MEMORY");
// 4 MB page cache — enough for this dataset, keeps RSS small on a 1 GB VPS.
sqlite.pragma("cache_size = -4000");

// drizzle-kit migrate has skipped new columns in production before; adding them here
// keeps a logged-in session from 500ing the homepage if a deploy missed the ALTER.
function ensureColumn(table: string, column: string, definition: string) {
    try {
        sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/duplicate column name/i.test(message)) throw err;
    }
}

ensureColumn("users", "last_seen_at", "text");

const db = drizzle(sqlite, { schema });

export function getSqlite() {
    return sqlite;
}

export async function getDb() {
    return db;
}
