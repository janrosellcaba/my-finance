"use client";

import { useEffect, useMemo, useState } from "react";
import { type TFunction } from "@/i18n";
import { useT } from "@/i18n/I18nProvider";
import { type Account, type Category, formatCurrency, formatDate, INK_BTN, INPUT_CLS } from "../shared";

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

async function fetchAllTransactions(): Promise<Transaction[]> {
    const all: Transaction[] = [];
    let cursor: { date: string; createdAt: string; id: string } | null = null;
    for (;;) {
        const params = new URLSearchParams();
        if (cursor) {
            params.set("cursorDate", cursor.date);
            params.set("cursorCreatedAt", cursor.createdAt);
            params.set("cursorId", cursor.id);
        }
        const res = await fetch(`/api/transactions?${params.toString()}`);
        const data = (await res.json()) as {
            success: boolean;
            transactions?: Transaction[];
            nextCursor?: { date: string; createdAt: string; id: string } | null;
        };
        if (!data.success || !data.transactions) break;
        all.push(...data.transactions);
        if (!data.nextCursor) break;
        cursor = data.nextCursor;
    }
    return all;
}

function buildExportRows(
    transactions: Transaction[],
    accounts: Account[],
    categories: Category[],
    t: TFunction
): string {
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

    type Row = { date: string; description: string; category: string; account: string; amount: number; type: string };
    const rows: Row[] = [];

    for (const tx of transactions) {
        if (tx.type === "transfer") {
            const sourceName = accountNames.get(tx.accountId) ?? t("common.unknown");
            const destName = accountNames.get(tx.destinationId) ?? t("common.unknown");
            rows.push({
                date: tx.date,
                description: t("export.transferTo", { name: destName }),
                category: t("export.transferIn"),
                account: destName,
                amount: tx.amount,
                type: "Transfer",
            });
            rows.push({
                date: tx.date,
                description: t("export.transferFrom", { name: sourceName }),
                category: t("export.transferOut"),
                account: sourceName,
                amount: -tx.amount,
                type: "Transfer",
            });
        } else {
            rows.push({
                date: tx.date,
                description: tx.description,
                category: categoryNames.get(tx.destinationId) ?? t("common.unknown"),
                account: accountNames.get(tx.accountId) ?? t("common.unknown"),
                amount: tx.type === "expense" ? -tx.amount : tx.amount,
                type: tx.type === "expense" ? "Expense" : "Income",
            });
        }
    }

    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return rows
        .map((r) => [r.date && formatDate(r.date), r.description, r.category, r.account, formatCurrency(r.amount), r.type].join("\t"))
        .join("\n");
}

export function ExportView({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
    const t = useT();
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
                if (!cancelled) setError(t("export.loadFailed"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const filtered = useMemo(
        () => transactions.filter((tx) => (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate)),
        [transactions, fromDate, toDate]
    );

    const text = useMemo(
        () => buildExportRows(filtered, accounts, categories, t),
        [filtered, accounts, categories, t]
    );

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError(t("export.copyFailed"));
        }
    }

    return (
        <div className="space-y-4">
            <section className="surface rounded-2xl p-5">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t("export.how")}</h2>
                <div className="space-y-2 text-sm text-muted">
                    <p>{t("export.intro")}</p>
                    <p>{t("export.columns", { cols: t("export.columnNames") })}</p>
                    <p>{t("export.rangeHint")}</p>
                </div>
            </section>

            <section className="surface rounded-2xl p-5">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("export.dateRange")}</h2>
                <div className="flex gap-2">
                    <label className="flex-1 block">
                        <span className="mb-1 block text-xs font-semibold text-muted">{t("export.from")}</span>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={INPUT_CLS} />
                    </label>
                    <label className="flex-1 block">
                        <span className="mb-1 block text-xs font-semibold text-muted">{t("export.to")}</span>
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
                        {t("export.clearRange")}
                    </button>
                )}
            </section>

            {loading && <p className="text-center text-muted">{t("export.loading")}</p>}
            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {!loading && !error && (
                <section className="surface rounded-2xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                            {t("export.count", { count: filtered.length })}
                        </h2>
                        <button type="button" onClick={handleCopy} className={`${INK_BTN} px-4 py-2 text-sm`}>
                            {copied ? t("export.copied") : t("export.copy")}
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
