"use client";

import { useCallback, useEffect, useState } from "react";
import { type Account, type Category, type Transaction, INPUT_CLS } from "../shared";
import { AddTransactionModal } from "./AddTransactionModal";
import { TransactionCard } from "./TransactionCard";
import { IconClose, IconFilter, IconSearch } from "./icons";

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
    const [cursor, setCursor] = useState<{ date: string; id: string } | null>(null);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const fetchPage = useCallback(
        async (after: { date: string; id: string } | null, replace: boolean) => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (categoryFilter) params.set("category", categoryFilter);
            if (after) {
                params.set("cursorDate", after.date);
                params.set("cursorId", after.id);
            }

            const res = await fetch(`/api/transactions?${params.toString()}`);
            const data = (await res.json()) as {
                success: boolean;
                transactions?: Transaction[];
                nextCursor?: { date: string; id: string } | null;
            };
            if (data.success && data.transactions) {
                setTransactions((prev) => (replace ? data.transactions! : [...prev, ...data.transactions!]));
                setHasMore(Boolean(data.nextCursor));
                setCursor(data.nextCursor ?? null);
            }
        },
        [search, categoryFilter]
    );

    useEffect(() => {
        setLoading(true);
        fetchPage(null, true).finally(() => setLoading(false));
    }, [fetchPage]);

    async function handleShowMore() {
        setLoadingMore(true);
        await fetchPage(cursor, false);
        setLoadingMore(false);
    }

    useEffect(() => {
        const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    return (
        <div className="space-y-4 px-5 pt-6">
            <h1 className="text-2xl font-extrabold text-ink">Transactions</h1>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search description…"
                        className={`pl-10 ${searchInput ? "pr-10" : ""} ${INPUT_CLS}`}
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput("")}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                        >
                            <IconClose className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
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
            </div>

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
                <div className="animate-pulse space-y-2 rounded-2xl border border-line bg-paper p-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between px-1 py-1.5">
                            <div className="space-y-2">
                                <div className="h-3.5 w-32 rounded-full bg-chip" />
                                <div className="h-2.5 w-20 rounded-full bg-chip" />
                            </div>
                            <div className="h-3.5 w-14 rounded-full bg-chip" />
                        </div>
                    ))}
                </div>
            ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 pt-14 text-center">
                    <div className="rounded-full bg-chip p-3 text-muted">
                        <IconSearch className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-ink">No transactions found</p>
                    <p className="text-sm text-muted">Try a different search term or filter.</p>
                </div>
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
                        fetchPage(null, true);
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
