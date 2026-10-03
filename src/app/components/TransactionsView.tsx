"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/I18nProvider";
import { type Account, type Category, type Transaction, INPUT_CLS, formatCurrency } from "../shared";
import { AddTransactionModal } from "./AddTransactionModal";
import { TransactionCard } from "./TransactionCard";
import { useUndoToast } from "./UndoToastProvider";
import { IconClose, IconFilter, IconSearch } from "./icons";

function signedAmount(tx: Transaction): number | null {
    if (tx.type === "transfer") return null;
    const mag = Math.abs(tx.amount);
    return tx.type === "expense" ? -mag : mag;
}

function formatSignedAmount(value: number, privacyMode: boolean): string {
    const formatted = formatCurrency(Math.abs(value), privacyMode);
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

function amountTone(value: number): string {
    if (value > 0) return "text-brand";
    if (value < 0) return "text-danger";
    return "text-ink";
}

function selectionStats(txs: Transaction[]) {
    const money = txs.map(signedAmount).filter((n): n is number => n != null);
    const sum = money.reduce((a, b) => a + b, 0);
    const avg = money.length > 0 ? sum / money.length : null;
    let max: number | null = null;
    for (const n of money) {
        if (max === null || Math.abs(n) > Math.abs(max) || (Math.abs(n) === Math.abs(max) && n > max)) {
            max = n;
        }
    }
    return { count: txs.length, moneyCount: money.length, sum, avg, max };
}

export function TransactionsView({
    accounts,
    categories,
    privacyMode,
    initialAccountFilter,
    onTransactionChanged,
}: {
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    initialAccountFilter?: string;
    onTransactionChanged: () => void;
}) {
    const t = useT();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [cursor, setCursor] = useState<{ date: string; createdAt: string; id: string } | null>(null);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [accountFilter, setAccountFilter] = useState(initialAccountFilter ?? "");
    const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense" | "transfer">("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const anchorIdRef = useRef<string | null>(null);
    const { requestDelete } = useUndoToast();

    const fetchPage = useCallback(
        async (
            after: { date: string; createdAt: string; id: string } | null,
            replace: boolean,
            signal?: AbortSignal,
        ) => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (categoryFilter) params.set("category", categoryFilter);
            if (accountFilter) params.set("account", accountFilter);
            if (typeFilter) params.set("type", typeFilter);
            if (dateFrom) params.set("startDate", dateFrom);
            if (dateTo) params.set("endDate", dateTo);
            if (after) {
                params.set("cursorDate", after.date);
                params.set("cursorCreatedAt", after.createdAt);
                params.set("cursorId", after.id);
            }

            try {
                const res = await fetch(`/api/transactions?${params.toString()}`, { signal });
                const data = (await res.json()) as {
                    success: boolean;
                    transactions?: Transaction[];
                    nextCursor?: { date: string; createdAt: string; id: string } | null;
                };
                if (data.success && data.transactions) {
                    setTransactions((prev) => (replace ? data.transactions! : [...prev, ...data.transactions!]));
                    setHasMore(Boolean(data.nextCursor));
                    setCursor(data.nextCursor ?? null);
                }
            } catch {
                // Aborted on unmount/filter change, or a brief network drop — keep the current list.
            }
        },
        [search, categoryFilter, accountFilter, typeFilter, dateFrom, dateTo]
    );

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        fetchPage(null, true, controller.signal).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [fetchPage]);

    useEffect(() => {
        setSelectedIds(new Set());
        anchorIdRef.current = null;
    }, [search, categoryFilter, accountFilter, typeFilter, dateFrom, dateTo]);

    function clearSelection() {
        setSelectedIds(new Set());
        anchorIdRef.current = null;
    }

    useEffect(() => {
        if (selectedIds.size === 0) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") clearSelection();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedIds.size]);

    function extendRange(prev: Set<string>, toId: string, ids: string[]): Set<string> {
        const fromId = anchorIdRef.current ?? toId;
        const a = ids.indexOf(fromId);
        const b = ids.indexOf(toId);
        const next = new Set(prev);
        if (a < 0 || b < 0) {
            next.add(toId);
            return next;
        }
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        for (let i = start; i <= end; i++) next.add(ids[i]!);
        return next;
    }

    function handleDeleteTransaction(tx: Transaction) {
        setEditingTransaction(null);
        setSelectedIds((prev) => {
            if (!prev.has(tx.id)) return prev;
            const next = new Set(prev);
            next.delete(tx.id);
            return next;
        });
        setPendingDeleteIds((prev) => new Set(prev).add(tx.id));
        requestDelete({
            message: t("tx.deleted"),
            onUndo: () => {
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(tx.id);
                    return next;
                });
            },
            onCommit: async () => {
                await fetch("/api/transactions", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: tx.id }),
                });
                setPendingDeleteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(tx.id);
                    return next;
                });
                onTransactionChanged();
                await fetchPage(null, true);
            },
        });
    }

    async function handleShowMore() {
        setLoadingMore(true);
        await fetchPage(cursor, false);
        setLoadingMore(false);
    }

    useEffect(() => {
        const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const visibleTransactions = transactions.filter((tx) => !pendingDeleteIds.has(tx.id));
    const visibleIds = visibleTransactions.map((tx) => tx.id);
    const selectedTxs = visibleTransactions.filter((tx) => selectedIds.has(tx.id));
    const stats = selectionStats(selectedTxs);
    const selecting = selectedIds.size > 0;
    const filtersActive = Boolean(categoryFilter || accountFilter || typeFilter || dateFrom || dateTo);

    function handleCardClick(tx: Transaction, shiftKey: boolean) {
        if (shiftKey) {
            setSelectedIds((prev) => {
                if (prev.size === 0) {
                    anchorIdRef.current = tx.id;
                    return new Set([tx.id]);
                }
                return extendRange(prev, tx.id, visibleIds);
            });
            return;
        }
        if (selecting) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(tx.id)) next.delete(tx.id);
                else next.add(tx.id);
                return next;
            });
            anchorIdRef.current = tx.id;
            return;
        }
        setEditingTransaction(tx);
    }

    function handleLongPress(tx: Transaction) {
        try {
            navigator.vibrate?.(12);
        } catch {
            /* ignore unsupported haptic */
        }
        setSelectedIds((prev) => {
            if (prev.size === 0) {
                anchorIdRef.current = tx.id;
                return new Set([tx.id]);
            }
            return extendRange(prev, tx.id, visibleIds);
        });
    }

    return (
        <div className={`space-y-4 px-5 pt-6 ${selecting ? "pb-16" : ""}`}>
            <h1 className="text-2xl font-semibold text-ink">{t("tx.title")}</h1>

            <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                    <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t("tx.searchPlaceholder")}
                        className={`pl-10 ${searchInput ? "pr-10" : ""} ${INPUT_CLS}`}
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput("")}
                            aria-label={t("tx.clearSearch")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                        >
                            <IconClose className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    aria-label={t("tx.toggleFilters")}
                    aria-pressed={showFilters}
                    className={`relative shrink-0 rounded-xl p-3 transition-colors duration-150 ${
                        showFilters ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                    }`}
                >
                    <IconFilter className="h-5 w-5" />
                    {filtersActive && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                    )}
                </button>
                {filtersActive && (
                    <button
                        type="button"
                        onClick={() => {
                            setCategoryFilter("");
                            setAccountFilter("");
                            setTypeFilter("");
                            setDateFrom("");
                            setDateTo("");
                            setShowFilters(false);
                        }}
                        aria-label={t("tx.clearFilters")}
                        className="shrink-0 rounded-xl bg-chip p-3 text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                )}
            </div>

            {showFilters && (
                <div className="space-y-3 surface rounded-2xl p-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {(["", "income", "expense", "transfer"] as const).map((txType) => (
                            <button
                                type="button"
                                key={txType || "all"}
                                onClick={() => setTypeFilter(txType)}
                                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 select-none ${
                                    typeFilter === txType
                                        ? txType === "income"
                                            ? "bg-brand text-white"
                                            : txType === "expense"
                                              ? "bg-danger text-white"
                                              : "bg-ink text-paper"
                                        : "bg-chip text-muted hover:bg-chip-hover"
                                }`}
                            >
                                {txType === "income"
                                    ? t("type.income")
                                    : txType === "expense"
                                      ? t("type.expense")
                                      : txType === "transfer"
                                        ? t("type.transfer")
                                        : t("type.allTypes")}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                            type="button"
                            onClick={() => setAccountFilter("")}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 select-none ${
                                accountFilter === "" ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {t("tx.allAccounts")}
                        </button>
                        {accounts.map((a) => (
                            <button
                                type="button"
                                key={a.id}
                                onClick={() => setAccountFilter(a.id)}
                                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 select-none ${
                                    accountFilter === a.id ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                                }`}
                            >
                                {a.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                            type="button"
                            onClick={() => setCategoryFilter("")}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 select-none ${
                                categoryFilter === "" ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {t("tx.allCategories")}
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

                    <div className="flex items-end gap-2">
                        <label className="flex-1 block">
                            <span className="mb-1 block text-xs font-semibold text-muted">{t("tx.from")}</span>
                            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT_CLS} />
                        </label>
                        <label className="flex-1 block">
                            <span className="mb-1 block text-xs font-semibold text-muted">{t("tx.to")}</span>
                            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={INPUT_CLS} />
                        </label>
                        {(dateFrom || dateTo) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setDateFrom("");
                                    setDateTo("");
                                }}
                                aria-label={t("tx.clearDateRange")}
                                className="shrink-0 rounded-xl bg-chip p-3 text-muted transition-colors duration-150 hover:bg-chip-hover hover:text-ink"
                            >
                                <IconClose className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="animate-pulse space-y-2 surface rounded-2xl p-3">
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
            ) : visibleTransactions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 pt-14 text-center">
                    <div className="rounded-full bg-chip p-3 text-muted">
                        <IconSearch className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-ink">{t("tx.noneFound")}</p>
                    <p className="text-sm text-muted">{t("tx.noneFoundHint")}</p>
                </div>
            ) : (
                <div className="divide-y divide-line surface overflow-hidden rounded-2xl">
                    {visibleTransactions.map((tx) => (
                        <TransactionCard
                            key={tx.id}
                            tx={tx}
                            accounts={accounts}
                            categories={categories}
                            privacyMode={privacyMode}
                            accountBalance={tx.balanceAfter}
                            selected={selectedIds.has(tx.id)}
                            onClick={({ shiftKey }) => handleCardClick(tx, shiftKey)}
                            onLongPress={() => handleLongPress(tx)}
                            compact
                        />
                    ))}
                </div>
            )}

            {selecting && stats.count > 0 && (
                <SelectionStatsBar stats={stats} privacyMode={privacyMode} onClear={clearSelection} />
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
                    onDelete={handleDeleteTransaction}
                />
            )}

            {hasMore && (
                <button
                    type="button"
                    onClick={handleShowMore}
                    disabled={loadingMore}
                    className="w-full rounded-2xl border-2 border-line py-3 font-semibold text-muted transition-colors duration-150 hover:border-brand hover:text-brand disabled:opacity-60 select-none"
                >
                    {loadingMore ? t("common.loading") : t("tx.showMore")}
                </button>
            )}
        </div>
    );
}

function SelectionStatsBar({
    stats,
    privacyMode,
    onClear,
}: {
    stats: ReturnType<typeof selectionStats>;
    privacyMode: boolean;
    onClear: () => void;
}) {
    const t = useT();
    const summaryParts = [
        t("tx.selectedCount", { count: stats.count }),
        stats.moneyCount > 0 && stats.avg != null && stats.max != null
            ? `${t("tx.sum")} ${formatSignedAmount(stats.sum, privacyMode)}, ${t("tx.avg")} ${formatSignedAmount(stats.avg, privacyMode)}, ${t("tx.max")} ${formatSignedAmount(stats.max, privacyMode)}`
            : null,
    ].filter(Boolean);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
            <div
                role="status"
                aria-live="polite"
                aria-label={summaryParts.join(". ")}
                className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl surface px-3 py-2.5 shadow-lg"
            >
                <div className="flex min-w-0 flex-1 items-center gap-x-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <span className="shrink-0 text-xs font-semibold text-muted">
                        {t("tx.selectedCount", { count: stats.count })}
                    </span>
                    {stats.moneyCount > 0 && (
                        <>
                            <Stat label={t("tx.sum")} value={formatSignedAmount(stats.sum, privacyMode)} tone={amountTone(stats.sum)} privacyMode={privacyMode} />
                            {stats.avg != null && (
                                <Stat
                                    label={t("tx.avg")}
                                    value={formatSignedAmount(stats.avg, privacyMode)}
                                    tone={amountTone(stats.avg)}
                                    privacyMode={privacyMode}
                                />
                            )}
                            {stats.max != null && (
                                <Stat
                                    label={t("tx.max")}
                                    value={formatSignedAmount(stats.max, privacyMode)}
                                    tone={amountTone(stats.max)}
                                    privacyMode={privacyMode}
                                />
                            )}
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    aria-label={t("tx.clearSelection")}
                    className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                >
                    <IconClose className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    tone,
    privacyMode,
}: {
    label: string;
    value: string;
    tone: string;
    privacyMode: boolean;
}) {
    return (
        <>
            <span className="shrink-0 text-muted/40">·</span>
            <span className="shrink-0 text-xs text-muted">{label}</span>
            <span
                className={`shrink-0 text-xs font-bold tabular-nums ${tone} ${
                    privacyMode ? "blur-[5px] select-none opacity-70" : ""
                }`}
            >
                {value}
            </span>
        </>
    );
}
