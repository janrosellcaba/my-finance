"use client";

import { useState } from "react";
import { useT } from "@/i18n/I18nProvider";
import { type Account, type Category, type DashboardSummary, type Transaction, formatCurrency, PRIMARY_BTN } from "../shared";
import { AddTransactionModal } from "./AddTransactionModal";
import { DeltaPill, Sparkline } from "./analytics/primitives";
import { AccountIcon } from "./icons";
import { TransactionCard } from "./TransactionCard";
import { useUndoToast } from "./UndoToastProvider";

function HomeSkeleton() {
    return (
        <div className="animate-pulse space-y-6 px-5 pt-6">
            <div className="surface rounded-3xl p-6 text-center">
                <div className="mx-auto h-3.5 w-24 rounded-full bg-chip" />
                <div className="mx-auto mt-3 h-9 w-40 rounded-full bg-chip" />
            </div>
            <div className="h-14 w-full rounded-2xl bg-chip" />
            <div>
                <div className="mb-3 h-3 w-28 rounded-full bg-chip" />
                <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="space-y-2 surface rounded-2xl p-4">
                            <div className="h-3 w-16 rounded-full bg-chip" />
                            <div className="h-5 w-20 rounded-full bg-chip" />
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <div className="mb-3 h-3 w-32 rounded-full bg-chip" />
                <div className="space-y-2 surface rounded-2xl p-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between px-1 py-1.5">
                            <div className="space-y-2">
                                <div className="h-3.5 w-32 rounded-full bg-chip" />
                                <div className="h-2.5 w-20 rounded-full bg-chip" />
                            </div>
                            <div className="h-3.5 w-14 rounded-full bg-chip" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function HomeView({
    dashboard,
    loading,
    accounts,
    categories,
    privacyMode,
    onAddClick,
    onAccountClick,
    onTransactionChanged,
}: {
    dashboard: DashboardSummary | null;
    loading: boolean;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onAddClick: () => void;
    onAccountClick: (accountId: string) => void;
    onTransactionChanged: () => void;
}) {
    const t = useT();
    const { requestDelete } = useUndoToast();
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

    if (loading) {
        return <HomeSkeleton />;
    }

    if (!dashboard) {
        return <p className="px-5 pt-10 text-center text-muted">{t("home.loadError")}</p>;
    }

    const positive = dashboard.totalNetWorth >= 0;
    const netWorthTone = positive ? "brand" : "danger";
    const recent = dashboard.recentTransactions.filter((tx) => !pendingDeleteIds.has(tx.id)).slice(0, 5);

    function handleDeleteTransaction(tx: Transaction) {
        setEditingTransaction(null);
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
            },
        });
    }

    return (
        <div className="space-y-6 px-5 pt-6">
            <div className="relative overflow-hidden surface rounded-3xl p-6 text-center">
                <div className="absolute inset-0 bg-gradient-to-b from-brand/5 via-transparent to-transparent pointer-events-none" />
                <p className="relative text-xs font-bold uppercase tracking-wider text-muted">{t("home.totalNetWorth")}</p>
                <p
                    className={`relative mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl tabular-nums transition-[filter,opacity] duration-250 ${
                        positive ? "text-brand" : "text-danger"
                    } ${privacyMode ? "blur-[9px] select-none opacity-70" : ""}`}
                >
                    {formatCurrency(dashboard.totalNetWorth)}
                </p>
                {dashboard.netWorthHistory.length > 1 && (
                    <div
                        className={`relative mx-auto mt-4 max-w-[180px] transition-[filter,opacity] duration-250 ${
                            privacyMode ? "blur-[5px] select-none opacity-40" : ""
                        }`}
                    >
                        <Sparkline values={dashboard.netWorthHistory} tone={netWorthTone} />
                        <p className="mt-1 text-[11px] font-medium text-muted">{t("home.past30Days")}</p>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onAddClick}
                className={`${PRIMARY_BTN} w-full`}
            >
                {t("home.addTransaction")}
            </button>

            <div>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("home.yourAccounts")}</h2>
                <div className="grid grid-cols-2 gap-3">
                    {dashboard.accounts.map((acc) => (
                        <button
                            key={acc.id}
                            type="button"
                            onClick={() => onAccountClick(acc.id)}
                            className="group surface w-full rounded-2xl p-4 text-left transition-all duration-150 hover:brightness-[1.01]"
                        >
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-chip text-muted transition-colors group-hover:text-ink">
                                    <AccountIcon iconKey={acc.icon ?? "wallet"} className="h-3.5 w-3.5" />
                                </span>
                                <p className="truncate text-xs font-semibold text-muted">{acc.name}</p>
                            </div>
                            <p
                                className={`mt-2 text-xl font-bold tracking-tight tabular-nums transition-[filter,opacity] duration-250 ${
                                    acc.balance >= 0 ? "text-brand" : "text-danger"
                                } ${privacyMode ? "blur-[7px] select-none opacity-70" : ""}`}
                            >
                                {formatCurrency(acc.balance)}
                            </p>
                            <div className="mt-1">
                                <DeltaPill delta={acc.delta} privacyMode={privacyMode} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t("home.recentActivity")}</h2>
                <div className="space-y-2">
                    {recent.length === 0 && <p className="text-sm text-muted">{t("home.noTransactions")}</p>}
                    {recent.map((tx) => (
                        <TransactionCard
                            key={tx.id}
                            tx={tx}
                            accounts={accounts}
                            categories={categories}
                            privacyMode={privacyMode}
                            accountBalance={tx.balanceAfter}
                            onClick={() => setEditingTransaction(tx)}
                        />
                    ))}
                </div>
            </div>

            {editingTransaction && (
                <AddTransactionModal
                    accounts={accounts}
                    categories={categories}
                    transaction={editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    onSaved={() => {
                        setEditingTransaction(null);
                        onTransactionChanged();
                    }}
                    onDelete={handleDeleteTransaction}
                />
            )}
        </div>
    );
}
