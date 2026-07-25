"use client";

import { useState, type FormEvent } from "react";
import { type Account, type Category, INK_BTN, INPUT_CLS, parseAmountEs, PRIMARY_BTN } from "../shared";
import { AccountList } from "./AccountList";
import { CategoryList } from "./CategoryList";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ExportView } from "./ExportView";
import { ImportView } from "./ImportView";
import { MenuRow } from "./MenuRow";
import { IconArrowLeft, IconGrip, IconPencil, IconRadioDot } from "./icons";

type ConfigSection = "menu" | "accounts" | "categories" | "export" | "import" | "danger";

const CONFIG_SECTION_TITLES: Record<Exclude<ConfigSection, "menu">, string> = {
    accounts: "Accounts",
    categories: "Categories",
    export: "Export Data",
    import: "Import Data",
    danger: "Delete Data",
};

export function ConfigView({
    accounts,
    categories,
    privacyMode,
    onRefresh,
    onLogout,
    onPasswordChanged,
    onImported,
    onAccountDeleted,
}: {
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onRefresh: () => void;
    onLogout: () => void;
    onPasswordChanged: () => void;
    onImported: () => void;
    onAccountDeleted: () => void;
}) {
    const [section, setSection] = useState<ConfigSection>("menu");
    const [accountName, setAccountName] = useState("");
    const [accountInitialBalance, setAccountInitialBalance] = useState("");
    const [categoryName, setCategoryName] = useState("");
    const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");
    const [savingAccount, setSavingAccount] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);
    const [error, setError] = useState("");
    const [showChangePassword, setShowChangePassword] = useState(false);

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
            onRefresh();
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
        onRefresh();
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
        onRefresh();
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
            onRefresh();
        } finally {
            setSavingCategory(false);
        }
    }

    async function handleDeleteAccount(a: Account) {
        if (
            !confirm(
                `Delete "${a.name}"? Are you sure? If there is money or transactions linked to this account, they will be lost.`
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
        onRefresh();
    }

    async function handleDeleteCategory(c: Category) {
        if (
            !confirm(
                `Delete "${c.name}"? Are you sure? If there is money or transactions linked to this category, they will be lost.`
            )
        ) {
            return;
        }
        setError("");
        const res = await fetch("/api/config", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: "category", id: c.id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not delete category.");
            return;
        }
        onRefresh();
    }

    async function handleDeleteAllTransactions() {
        if (
            !confirm(
                "Delete ALL transactions? This also resets every account's initial balance to 0. This cannot be undone."
            )
        ) {
            return;
        }
        setError("");
        const res = await fetch("/api/danger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete-transactions" }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not delete transactions.");
            return;
        }
        onRefresh();
    }

    async function handleDeleteMyAccount() {
        if (
            !confirm(
                "Permanently delete your account and ALL of your data (transactions, accounts, categories)? You will be logged out immediately. This cannot be undone."
            )
        ) {
            return;
        }
        setError("");
        const res = await fetch("/api/danger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete-account" }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not delete your account.");
            return;
        }
        onAccountDeleted();
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
        onRefresh();
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
        onRefresh();
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
        onRefresh();
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
        onRefresh();
    }

    if (section === "menu") {
        return (
            <div className="space-y-6 px-5 pt-6">
                <h1 className="text-2xl font-extrabold text-ink">Configuration</h1>

                {error && <p className="text-sm font-medium text-danger">{error}</p>}

                <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
                    <MenuRow label="Bank Accounts" onClick={() => setSection("accounts")} />
                    <MenuRow label="Categories" onClick={() => setSection("categories")} />
                    <MenuRow label="Export Data" onClick={() => setSection("export")} />
                    <MenuRow label="Import Data" onClick={() => setSection("import")} />
                    <MenuRow
                        label="Change Password"
                        chevron={false}
                        onClick={() => setShowChangePassword(true)}
                    />
                    <MenuRow label="Delete Data" danger onClick={() => setSection("danger")} />
                    <MenuRow label="Log Out" chevron={false} danger last onClick={onLogout} />
                </div>

                {showChangePassword && (
                    <ChangePasswordModal
                        onClose={() => setShowChangePassword(false)}
                        onChanged={onPasswordChanged}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 px-5 pt-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setSection("menu")}
                    aria-label="Back to configuration"
                    className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                >
                    <IconArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-extrabold text-ink">{CONFIG_SECTION_TITLES[section]}</h1>
            </div>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {section === "accounts" && (
                <section className="space-y-4 rounded-2xl border border-line bg-paper p-5 shadow-sm">
                    <p className="text-sm text-muted">
                        Tap <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> next to the name to rename
                        an account — it updates everywhere automatically. Tap the other{" "}
                        <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> to set its initial balance,
                        useful when you start tracking an account that already has money in it, so you don&apos;t
                        have to add an income transaction for it.
                    </p>
                    <AccountList
                        items={accounts}
                        privacyMode={privacyMode}
                        onRename={handleRenameAccount}
                        onSetInitialBalance={handleSetInitialBalance}
                        onDelete={handleDeleteAccount}
                    />
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
                            placeholder="Initial balance (optional, defaults to 0)"
                            className={INPUT_CLS}
                        />
                        <button type="submit" disabled={savingAccount} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                            Add
                        </button>
                    </form>
                </section>
            )}

            {section === "categories" && (
                <section className="space-y-5 rounded-2xl border border-line bg-paper p-5 shadow-sm">
                    <p className="text-sm text-muted">
                        Drag <IconGrip className="inline h-3.5 w-3.5 -translate-y-0.5" /> to reorder categories. Tap{" "}
                        <IconRadioDot className="inline h-3.5 w-3.5 -translate-y-0.5" /> to set the default category
                        for that type — it&apos;ll be pre-selected when you add a new transaction. Tap the color dot
                        to change the color shown on that category&apos;s transactions, or{" "}
                        <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> to rename it (existing
                        transactions update automatically).
                    </p>
                    <CategoryList
                        title="Income"
                        type="income"
                        items={categories.filter((c) => c.type === "income")}
                        onReorder={handleReorderCategories}
                        onSetDefault={handleSetDefault}
                        onSetColor={handleSetCategoryColor}
                        onRename={handleRenameCategory}
                        onDelete={handleDeleteCategory}
                    />
                    <CategoryList
                        title="Expense"
                        type="expense"
                        items={categories.filter((c) => c.type === "expense")}
                        onReorder={handleReorderCategories}
                        onSetDefault={handleSetDefault}
                        onSetColor={handleSetCategoryColor}
                        onRename={handleRenameCategory}
                        onDelete={handleDeleteCategory}
                    />
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
                                className={`flex-1 rounded-xl py-3 font-bold transition-colors duration-150 select-none ${
                                    categoryType === "income" ? "bg-brand text-white" : "bg-chip text-muted hover:bg-chip-hover"
                                }`}
                            >
                                Income
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryType("expense")}
                                className={`flex-1 rounded-xl py-3 font-bold transition-colors duration-150 select-none ${
                                    categoryType === "expense" ? "bg-danger text-white" : "bg-chip text-muted hover:bg-chip-hover"
                                }`}
                            >
                                Expense
                            </button>
                        </div>
                        <button type="submit" disabled={savingCategory} className={`${INK_BTN} w-full`}>
                            Add Category
                        </button>
                    </form>
                </section>
            )}

            {section === "export" && <ExportView accounts={accounts} categories={categories} />}

            {section === "import" && (
                <ImportView accounts={accounts} categories={categories} onImported={onImported} />
            )}

            {section === "danger" && (
                <section className="space-y-3 rounded-2xl border border-line bg-paper p-5 shadow-sm">
                    <p className="text-sm text-muted">These actions are permanent and cannot be undone.</p>
                    <button
                        type="button"
                        onClick={handleDeleteAllTransactions}
                        className={`${PRIMARY_BTN} w-full bg-danger hover:bg-danger-dark`}
                    >
                        Delete All Transactions
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteMyAccount}
                        className={`${PRIMARY_BTN} w-full bg-danger hover:bg-danger-dark`}
                    >
                        Delete My Account
                    </button>
                </section>
            )}
        </div>
    );
}
