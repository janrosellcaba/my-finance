"use client";

import { useState, type FormEvent } from "react";
import {
    type Account,
    type Category,
    INK_BTN,
    INPUT_CLS,
    PRIMARY_BTN,
    parseAmountEs,
} from "../shared";
import { AccountList } from "./AccountList";
import { CategoryList } from "./CategoryList";
import { useUndoToast } from "./UndoToastProvider";

export function SetupWizard({
    accounts,
    categories,
    privacyMode,
    onRefresh,
    onFinished,
}: {
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onRefresh: () => Promise<void> | void;
    onFinished: () => void;
}) {
    const [accountName, setAccountName] = useState("");
    const [accountInitialBalance, setAccountInitialBalance] = useState("");
    const [categoryName, setCategoryName] = useState("");
    const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");
    const [savingAccount, setSavingAccount] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);
    const [error, setError] = useState("");
    const [pendingDeleteCategoryIds, setPendingDeleteCategoryIds] = useState<Set<string>>(new Set());
    const { requestDelete } = useUndoToast();

    async function handleAddAccount(e: FormEvent) {
        e.preventDefault();
        if (!accountName.trim()) return;
        const trimmedBalance = accountInitialBalance.trim();
        const initialBalance = trimmedBalance ? parseAmountEs(trimmedBalance) : 0;
        if (initialBalance === null) {
            setError("Invalid initial balance.");
            return;
        }
        setSavingAccount(true);
        setError("");
        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: "account", name: accountName.trim(), initialBalance }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not add account.");
                return;
            }
            setAccountName("");
            setAccountInitialBalance("");
            await onRefresh();
        } finally {
            setSavingAccount(false);
        }
    }

    async function handleSetInitialBalance(a: Account, rawValue: string) {
        const value = parseAmountEs(rawValue);
        if (value === null) {
            setError("Invalid initial balance.");
            return;
        }
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-initial-balance", id: a.id, initialBalance: value }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not update initial balance.");
            return;
        }
        await onRefresh();
    }

    async function handleRenameAccount(a: Account, name: string) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "rename-account", id: a.id, name }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not rename account.");
            return;
        }
        await onRefresh();
    }

    async function handleDeleteAccount(a: Account) {
        if (
            !confirm(
                `Delete “${a.name}”? This also deletes every transaction linked to it. This cannot be undone.`
            )
        ) {
            return;
        }
        setError("");
        const res = await fetch("/api/config", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: "account", id: a.id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not delete account.");
            return;
        }
        await onRefresh();
    }

    async function handleSetDefaultAccount(a: Account) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-default-account", id: a.isDefault ? null : a.id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not update default account.");
            return;
        }
        await onRefresh();
    }

    async function handleSetAccountIcon(a: Account, icon: string | null) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-account-icon", id: a.id, icon }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not update account icon.");
            return;
        }
        await onRefresh();
    }

    async function handleAddCategory(e: FormEvent) {
        e.preventDefault();
        if (!categoryName.trim()) return;
        setSavingCategory(true);
        setError("");
        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: "category", name: categoryName.trim(), type: categoryType }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not add category.");
                return;
            }
            setCategoryName("");
            await onRefresh();
        } finally {
            setSavingCategory(false);
        }
    }

    function handleDeleteCategory(c: Category) {
        setError("");
        setPendingDeleteCategoryIds((prev) => new Set(prev).add(c.id));
        requestDelete({
            message: `“${c.name}” deleted.`,
            onUndo: () => {
                setPendingDeleteCategoryIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c.id);
                    return next;
                });
            },
            onCommit: async () => {
                const res = await fetch("/api/config", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target: "category", id: c.id }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) setError(data.error || "Could not delete category.");
                setPendingDeleteCategoryIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c.id);
                    return next;
                });
                await onRefresh();
            },
        });
    }

    async function handleReorderCategories(type: "income" | "expense", orderedIds: string[]): Promise<boolean> {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", type, orderedIds }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not reorder categories.");
            return false;
        }
        await onRefresh();
        return true;
    }

    async function handleSetDefault(c: Category) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-default", type: c.type, id: c.isDefault ? null : c.id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not update default category.");
            return;
        }
        await onRefresh();
    }

    async function handleSetCategoryColor(c: Category, color: string) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-color", type: c.type, id: c.id, color }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not update category color.");
            return;
        }
        await onRefresh();
    }

    async function handleSetCategoryIcon(c: Category, icon: string | null) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-icon", type: c.type, id: c.id, icon }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not update category icon.");
            return;
        }
        await onRefresh();
    }

    async function handleRenameCategory(c: Category, name: string) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "rename", type: c.type, id: c.id, name }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not rename category.");
            return;
        }
        await onRefresh();
    }

    const income = categories.filter((c) => c.type === "income" && !pendingDeleteCategoryIds.has(c.id));
    const expense = categories.filter((c) => c.type === "expense" && !pendingDeleteCategoryIds.has(c.id));

    return (
        <div className="fixed inset-0 z-[70] flex flex-col bg-cream">
            <header className="surface-header shrink-0 border-b px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">Quick setup</p>
                <h1 className="mt-1 text-2xl font-extrabold text-ink">Make it yours</h1>
                <p className="mt-1 text-sm text-muted">
                    Starter accounts and categories are ready — rename them, set balances, add what you need, then
                    continue.
                </p>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto max-w-md space-y-6 px-5 py-5 pb-28">
                    {error && <p className="text-sm font-medium text-danger">{error}</p>}

                    <section className="space-y-3">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">1 · Bank accounts</h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted">
                                Set each account&apos;s initial balance to what it already holds. Tap the radio for
                                your default account.
                            </p>
                        </div>
                        <div className="surface overflow-hidden rounded-2xl">
                            <AccountList
                                items={accounts}
                                privacyMode={privacyMode}
                                onRename={handleRenameAccount}
                                onSetInitialBalance={handleSetInitialBalance}
                                onSetDefault={handleSetDefaultAccount}
                                onSetIcon={handleSetAccountIcon}
                                onDelete={handleDeleteAccount}
                            />
                        </div>
                        <form onSubmit={handleAddAccount} className="space-y-2">
                            <input
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="New account name"
                                className={INPUT_CLS}
                            />
                            <input
                                value={accountInitialBalance}
                                onChange={(e) => setAccountInitialBalance(e.target.value)}
                                inputMode="decimal"
                                placeholder="Initial balance (optional)"
                                className={INPUT_CLS}
                            />
                            <button type="submit" disabled={savingAccount} className={`${INK_BTN} w-full`}>
                                Add account
                            </button>
                        </form>
                    </section>

                    <section className="space-y-3">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">2 · Categories</h2>
                            <p className="mt-1 text-xs leading-relaxed text-muted">
                                Add labels you actually use. Colour and icon show up on transactions and analytics.
                            </p>
                        </div>
                        <div className="space-y-4 surface rounded-2xl p-4">
                            <CategoryList
                                title="Income"
                                type="income"
                                items={income}
                                onReorder={handleReorderCategories}
                                onSetDefault={handleSetDefault}
                                onSetColor={handleSetCategoryColor}
                                onSetIcon={handleSetCategoryIcon}
                                onRename={handleRenameCategory}
                                onDelete={handleDeleteCategory}
                            />
                            <CategoryList
                                title="Expense"
                                type="expense"
                                items={expense}
                                onReorder={handleReorderCategories}
                                onSetDefault={handleSetDefault}
                                onSetColor={handleSetCategoryColor}
                                onSetIcon={handleSetCategoryIcon}
                                onRename={handleRenameCategory}
                                onDelete={handleDeleteCategory}
                            />
                        </div>
                        <form onSubmit={handleAddCategory} className="space-y-2">
                            <input
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                placeholder="New category name"
                                className={INPUT_CLS}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCategoryType("income")}
                                    className={`flex-1 rounded-xl py-3 font-bold transition-colors select-none ${
                                        categoryType === "income"
                                            ? "bg-brand text-white"
                                            : "bg-chip text-muted hover:bg-chip-hover"
                                    }`}
                                >
                                    Income
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCategoryType("expense")}
                                    className={`flex-1 rounded-xl py-3 font-bold transition-colors select-none ${
                                        categoryType === "expense"
                                            ? "bg-danger text-white"
                                            : "bg-chip text-muted hover:bg-chip-hover"
                                    }`}
                                >
                                    Expense
                                </button>
                            </div>
                            <button type="submit" disabled={savingCategory} className={`${INK_BTN} w-full`}>
                                Add category
                            </button>
                        </form>
                    </section>
                </div>
            </div>

            <div className="surface-nav shrink-0 border-t px-5 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-md gap-2">
                    <button
                        type="button"
                        onClick={onFinished}
                        className="rounded-2xl bg-chip px-4 py-3.5 text-sm font-bold text-muted select-none hover:bg-chip-hover hover:text-ink"
                    >
                        Skip for now
                    </button>
                    <button type="button" onClick={onFinished} className={`${PRIMARY_BTN} min-w-0 flex-1 !py-3.5 !text-base`}>
                        Done — go to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
