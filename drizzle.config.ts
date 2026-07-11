import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Config } from "drizzle-kit";

function getLocalD1DB() {
    const d1Dir = path.resolve(
        ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
    );
    if (!existsSync(d1Dir)) return null;
    const dbFile = readdirSync(d1Dir).find((f) => f.endsWith(".sqlite"));
    return dbFile ? path.join(d1Dir, dbFile) : null;
}

function loadDevVars() {
    const file = path.resolve(".dev.vars");
    if (!existsSync(file)) return;
    for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
        if (!match) continue;
        const [, key, value = ""] = match;
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadDevVars();

const useRemote = process.env.D1_REMOTE === "true";
const localDb = !useRemote ? getLocalD1DB() : null;

export default (localDb
    ? {
          schema: "./src/db/schema.ts",
          out: "./drizzle",
          dialect: "sqlite",
          dbCredentials: { url: localDb },
      }
    : {
          schema: "./src/db/schema.ts",
          out: "./drizzle",
          dialect: "sqlite",
          driver: "d1-http",
          dbCredentials: {
              accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
              databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
              token: process.env.CLOUDFLARE_D1_TOKEN!,
          },
      }) satisfies Config;