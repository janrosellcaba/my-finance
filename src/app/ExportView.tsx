"use client";

import { useEffect, useMemo, useState } from "react";
import { type Account, type Category, eur, formatDate, INK_BTN, INPUT_CLS } from "./shared";

type TransactionType = "income" | "expense" | "transfer";
type Transaction = {
    id: string;
    date: string;
    description: string;
    type: TransactionType;
    amount: number;
    accountId: string;
    destinationId: string;
};

const PAGE_LIMIT = 100;

async function fetchAllTransactions(): Promise<Transaction[]> {
    const all: Transaction[] = [];
    let page = 1;
    for (;;) {
        const res = await fetch(`/api/transactions?page=${page}`);
        const data = (await res.json()) as { success: boolean; transactions?: Transaction[] };
        if (!data.success || !data.transactions) break;
        all.push(...data.transactions);
        if (data.transactions.length < PAGE_LIMIT) break;
        page += 1;
    }
    return all;
}

function buildExportRows(transactions: Transaction[], accounts: Account[], categories: Category[]): string {
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

    type Row = { date: string; description: string; category: string; account: string; amount: number; type: string };
    const rows: Row[] = [];

    for (const tx of transactions) {
        if (tx.type === "transfer") {
            const sourceName = accountNames.get(tx.accountId) ?? "Unknown";
            const destName = accountNames.get(tx.destinationId) ?? "Unknown";
            rows.push({
                date: tx.date,
                description: `Transfer to ${destName}`,
                category: "Transfer In",
                account: destName,
                amount: tx.amount,
                type: "Transfer",
            });
            rows.push({
                date: tx.date,
                description: `Transfer from ${sourceName}`,
                category: "Transfer Out",
                account: sourceName,
                amount: -tx.amount,
                type: "Transfer",
            });
        } else {
            rows.push({
                date: tx.date,
                description: tx.description,
                category: categoryNames.get(tx.destinationId) ?? "Unknown",
                account: accountNames.get(tx.accountId) ?? "Unknown",
                amount: tx.type === "expense" ? -tx.amount : tx.amount,
                type: tx.type === "expense" ? "Expense" : "Income",
            });
        }
    }

    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return rows
        .map((r) => [r.date && formatDate(r.date), r.description, r.category, r.account, eur.format(r.amount), r.type].join("\t"))
        .join("\n");
}

export function ExportView({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        fetchAllTransactions()
            .then((all) => {
                if (!cancelled) setTransactions(all);
            })
            .catch(() => {
                if (!cancelled) setError("Could not load your transactions.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const filtered = useMemo(
        () => transactions.filter((tx) => (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate)),
        [transactions, fromDate, toDate]
    );

    const text = useMemo(() => buildExportRows(filtered, accounts, categories), [filtered, accounts, categories]);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("Could not copy automatically — select the text below and copy it manually.");
        }
    }

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">How it works</h2>
                <p className="text-sm text-muted">
                    Copy the text below and paste it straight into a spreadsheet — each column lands in its own
                    cell. Columns are Date, Description, Category, Account, Amount, Type, newest first. Transfers
                    are split into two rows, just like your original sheet. By default everything is included —
                    narrow it down with a date range below if you only want part of your history.
                </p>
            </section>

            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Date range</h2>
                <div className="flex gap-2">
                    <label className="flex-1 block">
                        <span className="mb-1 block text-xs font-semibold text-muted">From</span>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={INPUT_CLS} />
                    </label>
                    <label className="flex-1 block">
                        <span className="mb-1 block text-xs font-semibold text-muted">To</span>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={INPUT_CLS} />
                    </label>
                </div>
                {(fromDate || toDate) && (
                    <button
                        type="button"
                        onClick={() => {
                            setFromDate("");
                            setToDate("");
                        }}
                        className="mt-2 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
                    >
                        Clear range (export everything)
                    </button>
                )}
            </section>

            {loading && <p className="text-center text-muted">Loading your transactions…</p>}
            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {!loading && !error && (
                <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                            {filtered.length} transactions
                        </h2>
                        <button type="button" onClick={handleCopy} className={`${INK_BTN} px-4 py-2 text-sm`}>
                            {copied ? "Copied!" : "Copy to Clipboard"}
                        </button>
                    </div>
                    <textarea
                        readOnly
                        value={text}
                        rows={12}
                        onFocus={(e) => e.target.select()}
                        className="w-full rounded-xl border border-line bg-paper p-3 font-mono text-xs text-ink"
                    />
                </section>
            )}
        </div>
    );
}
