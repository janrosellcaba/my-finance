import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { account, category, transaction } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { and, eq, sql } from "drizzle-orm";
import { isInitialBalanceRow, MAX_IMPORT_TRANSACTIONS } from "@/app/shared";

type ImportRow = {
    date: string;
    description: string;
    type: "income" | "expense" | "transfer";
    amount: number;
    accountName: string;
    destinationName: string;
};


function rowError(row: unknown): string | null {
    if (!row || typeof row !== "object") return "not an object";
    const r = row as Record<string, unknown>;
    if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return `invalid date "${r.date}"`;
    if (typeof r.description !== "string") return "description must be a string";
    if (typeof r.type !== "string" || !["income", "expense", "transfer"].includes(r.type)) {
        return `invalid type "${r.type}"`;
    }
    if (typeof r.amount !== "number" || r.amount < 0) return `invalid amount "${r.amount}"`;
    if (typeof r.accountName !== "string" || r.accountName.trim().length === 0) return "missing accountName";
    if (typeof r.destinationName !== "string" || r.destinationName.trim().length === 0) return "missing destinationName";
    return null;
}

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as { mode?: unknown; transactions?: unknown } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { mode, transactions: rows } = body;
        if (mode !== "replace" && mode !== "merge") {
            return NextResponse.json({ error: "Invalid import mode." }, { status: 400 });
        }
        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: "No transaction rows to import." }, { status: 400 });
        }
        if (rows.length > MAX_IMPORT_TRANSACTIONS) {
            return NextResponse.json(
                {
                    error: `Too many rows (${rows.length}). Import at most ${MAX_IMPORT_TRANSACTIONS} transactions at a time — split larger histories into multiple imports.`,
                },
                { status: 400 }
            );
        }
        const rowErrors = rows.map((row, i) => ({ i, err: rowError(row) })).filter((r) => r.err);
        if (rowErrors.length > 0) {
            const preview = rowErrors
                .slice(0, 5)
                .map((r) => `row ${r.i + 1}: ${r.err}`)
                .join("; ");
            return NextResponse.json(
                { error: `${rowErrors.length} invalid row(s) — ${preview}${rowErrors.length > 5 ? "; …" : ""}` },
                { status: 400 }
            );
        }
        const importRows = rows as ImportRow[];

        const db = await getDb();

        const accountMap = new Map<string, string>();
        const categoryMap = new Map<string, string>();

        if (mode === "replace") {
            db.transaction((tx) => {
                tx.delete(transaction).where(eq(transaction.userId, user.id)).run();
                tx.delete(category).where(eq(category.userId, user.id)).run();
                tx.delete(account).where(eq(account.userId, user.id)).run();
            });
        } else {
            const [existingAccounts, existingCategories] = await Promise.all([
                db.select().from(account).where(eq(account.userId, user.id)).all(),
                db.select().from(category).where(eq(category.userId, user.id)).all(),
            ]);
            for (const a of existingAccounts) accountMap.set(a.name.trim().toLowerCase(), a.id);
            for (const c of existingCategories) categoryMap.set(`${c.type}:${c.name.trim().toLowerCase()}`, c.id);
        }

        const newAccounts: { id: string; userId: string; name: string; initialBalance: number }[] = [];
        const newCategories: { id: string; userId: string; name: string; type: "income" | "expense" }[] = [];

        function resolveAccount(name: string): string {
            const key = name.trim().toLowerCase();
            const existing = accountMap.get(key);
            if (existing) return existing;
            const id = crypto.randomUUID();
            accountMap.set(key, id);
            newAccounts.push({ id, userId: user!.id, name: name.trim(), initialBalance: 0 });
            return id;
        }

        function resolveCategory(name: string, type: "income" | "expense"): string {
            const key = `${type}:${name.trim().toLowerCase()}`;
            const existing = categoryMap.get(key);
            if (existing) return existing;
            const id = crypto.randomUUID();
            categoryMap.set(key, id);
            newCategories.push({ id, userId: user!.id, name: name.trim(), type });
            return id;
        }

        const initialBalanceDeltas = new Map<string, number>();
        const transactionRows: {
            id: string;
            userId: string;
            date: string;
            description: string;
            type: "income" | "expense" | "transfer";
            amount: number;
            accountId: string;
            destinationId: string;
        }[] = [];

        let initialBalanceRowsApplied = 0;

        for (const row of importRows) {
            const accountId = resolveAccount(row.accountName);

            if (isInitialBalanceRow(row.type, row.destinationName)) {
                initialBalanceDeltas.set(accountId, (initialBalanceDeltas.get(accountId) ?? 0) + row.amount);
                initialBalanceRowsApplied++;
                continue;
            }

            const destinationId =
                row.type === "transfer"
                    ? resolveAccount(row.destinationName)
                    : resolveCategory(row.destinationName, row.type);

            transactionRows.push({
                id: crypto.randomUUID(),
                userId: user.id,
                date: row.date,
                description: row.description.trim(),
                type: row.type,
                amount: row.amount,
                accountId,
                destinationId,
            });
        }

        const newAccountsById = new Map(newAccounts.map((a) => [a.id, a]));
        const existingAccountDeltas: [string, number][] = [];
        for (const [accountId, delta] of initialBalanceDeltas) {
            const pending = newAccountsById.get(accountId);
            if (pending) {
                pending.initialBalance += delta;
            } else {
                existingAccountDeltas.push([accountId, delta]);
            }
        }
        db.transaction((tx) => {
            for (const [accountId, delta] of existingAccountDeltas) {
                tx.update(account)
                    .set({ initialBalance: sql`${account.initialBalance} + ${delta}` })
                    .where(and(eq(account.id, accountId), eq(account.userId, user.id)))
                    .run();
            }

            if (newAccounts.length > 0) {
                const BATCH = 100;
                for (let i = 0; i < newAccounts.length; i += BATCH) {
                    tx.insert(account).values(newAccounts.slice(i, i + BATCH)).run();
                }
            }

            if (newCategories.length > 0) {
                const BATCH = 100;
                for (let i = 0; i < newCategories.length; i += BATCH) {
                    tx.insert(category).values(newCategories.slice(i, i + BATCH)).run();
                }
            }

            if (transactionRows.length > 0) {
                const BATCH = 100;
                for (let i = 0; i < transactionRows.length; i += BATCH) {
                    tx.insert(transaction).values(transactionRows.slice(i, i + BATCH)).run();
                }
            }
        });

        return NextResponse.json({
            success: true,
            imported: transactionRows.length,
            accountsCreated: newAccounts.length,
            categoriesCreated: newCategories.length,
            initialBalanceRowsApplied,
        });
    } catch (error) {
        console.error("Import error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
