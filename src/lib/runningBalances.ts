import type Database from "better-sqlite3";
import { round2 } from "./balances";

export type PageTx = {
    id: string;
    type: "income" | "expense" | "transfer";
    accountId: string;
    destinationId: string;
};

type RunningRow = { id: string; acc_id: string; balance_after: number };

/** Running account balance after each listed tx, computed in SQLite so Node
 *  never materialises the full history. */
export function balanceAfterForPage(
    sqlite: Database.Database,
    userId: string,
    page: PageTx[],
    accountFilter: string
): Record<string, number> {
    if (page.length === 0) return {};

    const ids = page.map((tx) => tx.id);
    const placeholders = ids.map(() => "?").join(",");
    const rows = sqlite
        .prepare(
            `
            WITH legs AS (
                SELECT id, date, created_at, account_id AS acc_id,
                    CASE type WHEN 'income' THEN amount ELSE -amount END AS delta
                FROM "transaction"
                WHERE user_id = ?
                UNION ALL
                SELECT id, date, created_at, destination_id, amount
                FROM "transaction"
                WHERE user_id = ? AND type = 'transfer'
            )
            SELECT r.id AS id, r.acc_id AS acc_id,
                COALESCE(a.initial_balance, 0) + r.run_delta AS balance_after
            FROM (
                SELECT id, acc_id,
                    SUM(delta) OVER (
                        PARTITION BY acc_id
                        ORDER BY date, created_at, id
                    ) AS run_delta
                FROM legs
            ) r
            LEFT JOIN account a ON a.id = r.acc_id
            WHERE r.id IN (${placeholders})
            `
        )
        .all(userId, userId, ...ids) as RunningRow[];

    const byTxAcc = new Map<string, number>();
    for (const row of rows) {
        byTxAcc.set(`${row.id}:${row.acc_id}`, round2(row.balance_after));
    }

    const result: Record<string, number> = {};
    for (const tx of page) {
        const accId =
            accountFilter && tx.type === "transfer" && tx.destinationId === accountFilter
                ? tx.destinationId
                : tx.accountId;
        result[tx.id] = byTxAcc.get(`${tx.id}:${accId}`) ?? 0;
    }
    return result;
}
