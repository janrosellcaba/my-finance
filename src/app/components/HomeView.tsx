"use client";

import { type Account, type Category, type DashboardSummary, formatCurrency, PRIMARY_BTN } from "../shared";
import { TransactionCard } from "./TransactionCard";

export function HomeView({
    dashboard,
    loading,
    accounts,
    categories,
    privacyMode,
    onAddClick,
}: {
    dashboard: DashboardSummary | null;
    loading: boolean;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onAddClick: () => void;
}) {
    if (loading) {
        return <p className="px-5 pt-10 text-center text-muted">Loading your finances…</p>;
    }

    if (!dashboard) {
        return <p className="px-5 pt-10 text-center text-muted">Could not load your dashboard.</p>;
    }

    const positive = dashboard.totalNetWorth >= 0;
    const recent = dashboard.recentTransactions.slice(0, 5);

    return (
        <div className="space-y-6 px-5 pt-6">
            <div className="rounded-3xl border border-line bg-paper p-6 text-center shadow-sm">
                <p className="text-sm font-semibold text-muted">Total Balance</p>
                <p className={`mt-2 text-4xl font-extrabold tracking-tight ${positive ? "text-brand" : "text-danger"}`}>
                    {formatCurrency(dashboard.totalNetWorth, privacyMode)}
                </p>
            </div>

            <button
                type="button"
                onClick={onAddClick}
                className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}
            >
                + Add Transaction
            </button>

            <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Your Accounts</h2>
                <div className="grid grid-cols-2 gap-3">
                    {dashboard.accounts.map((acc) => (
                        <div key={acc.id} className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
                            <p className="truncate text-sm font-medium text-muted">{acc.name}</p>
                            <p className={`mt-1 text-xl font-bold ${acc.balance >= 0 ? "text-brand" : "text-danger"}`}>
                                {formatCurrency(acc.balance, privacyMode)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Recent Activity</h2>
                <div className="space-y-2">
                    {recent.length === 0 && <p className="text-sm text-muted">No transactions yet.</p>}
                    {recent.map((tx) => (
                        <TransactionCard
                            key={tx.id}
                            tx={tx}
                            accounts={accounts}
                            categories={categories}
                            privacyMode={privacyMode}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
