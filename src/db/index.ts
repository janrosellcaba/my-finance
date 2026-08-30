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

const db = drizzle(sqlite, { schema });

export function getSqlite() {
    return sqlite;
}

export async function getDb() {
    return db;
}
