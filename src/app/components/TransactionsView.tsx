"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { type Account, type Category, type Transaction, INK_BTN, INPUT_CLS } from "../shared";
import { AddTransactionModal } from "./AddTransactionModal";
import { TransactionCard } from "./TransactionCard";
import { IconFilter } from "./icons";

export function TransactionsView({
    accounts,
    categories,
    privacyMode,
    onTransactionChanged,
}: {
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onTransactionChanged: () => void;
}) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const fetchPage = useCallback(
        async (targetPage: number, replace: boolean) => {
            const params = new URLSearchParams({ page: String(targetPage) });
            if (search) params.set("search", search);
            if (categoryFilter) params.set("category", categoryFilter);

            const res = await fetch(`/api/transactions?${params.toString()}`);
            const data = (await res.json()) as { success: boolean; transactions?: Transaction[]; limit?: number };
            if (data.success && data.transactions) {
                setTransactions((prev) => (replace ? data.transactions! : [...prev, ...data.transactions!]));
                setHasMore(data.transactions.length === (data.limit ?? 100));
                setPage(targetPage);
            }
        },
        [search, categoryFilter]
    );

    useEffect(() => {
        setLoading(true);
        fetchPage(1, true).finally(() => setLoading(false));
    }, [fetchPage]);

    async function handleShowMore() {
        setLoadingMore(true);
        await fetchPage(page + 1, false);
        setLoadingMore(false);
    }

    function handleSearchSubmit(e: FormEvent) {
        e.preventDefault();
        setSearch(searchInput.trim());
    }

    return (
        <div className="space-y-4 px-5 pt-6">
            <h1 className="text-2xl font-extrabold text-ink">Transactions</h1>

            <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search description…"
                    className={`flex-1 ${INPUT_CLS}`}
                />
                <button type="submit" className={INK_BTN}>
                    Search
                </button>
                <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    aria-label="Toggle category filters"
                    aria-pressed={showFilters}
                    className={`relative shrink-0 rounded-xl p-3 transition-colors duration-150 ${
                        showFilters ? "bg-ink text-white" : "bg-chip text-muted hover:bg-chip-hover"
                    }`}
                >
                    <IconFilter className="h-5 w-5" />
                    {categoryFilter && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                    )}
                </button>
            </form>

            {showFilters && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                        type="button"
                        onClick={() => setCategoryFilter("")}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 select-none ${
                            categoryFilter === "" ? "bg-ink text-white" : "bg-chip text-muted hover:bg-chip-hover"
                        }`}
                    >
                        All
                    </button>
                    {categories.map((c) => (
                        <button
                            type="button"
                            key={c.id}
                            onClick={() => setCategoryFilter(c.id)}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 select-none ${
                                categoryFilter === c.id
                                    ? c.type === "income"
                                        ? "bg-brand text-white"
                                        : "bg-danger text-white"
                                    : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <p className="pt-10 text-center text-muted">Loading…</p>
            ) : transactions.length === 0 ? (
                <p className="pt-10 text-center text-muted">No transactions found.</p>
            ) : (
                <div className="divide-y divide-line rounded-2xl border border-line bg-paper shadow-sm">
                    {transactions.map((tx) => (
                        <TransactionCard
                            key={tx.id}
                            tx={tx}
                            accounts={accounts}
                            categories={categories}
                            privacyMode={privacyMode}
                            onClick={() => setEditingTransaction(tx)}
                            compact
                        />
                    ))}
                </div>
            )}

            {editingTransaction && (
                <AddTransactionModal
                    accounts={accounts}
                    categories={categories}
                    transaction={editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    onSaved={() => {
                        setEditingTransaction(null);
                        fetchPage(1, true);
                        onTransactionChanged();
                    }}
                />
            )}

            {hasMore && (
                <button
                    type="button"
                    onClick={handleShowMore}
                    disabled={loadingMore}
                    className="w-full rounded-2xl border-2 border-line py-3 font-semibold text-muted transition-colors duration-150 hover:border-brand hover:text-brand disabled:opacity-60 select-none"
                >
                    {loadingMore ? "Loading…" : "Show More"}
                </button>
            )}
        </div>
    );
}
