"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
    type Account,
    type AppearancePrefs,
    type Category,
    ACCENT_COLORS,
    CURRENCY_OPTIONS,
    DANGER_BTN,
    DATE_FORMAT_OPTIONS,
    INK_BTN,
    INPUT_CLS,
    parseAmountEs,
    PRIMARY_BTN,
} from "../shared";
import { AccountList } from "./AccountList";
import { CategoryList } from "./CategoryList";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ExportView } from "./ExportView";
import { ImportView } from "./ImportView";
import { MenuRow } from "./MenuRow";
import { useUndoToast } from "./UndoToastProvider";
import { IconArrowLeft, IconGrip, IconPencil, IconRadioDot } from "./icons";

type ConfigSection =
    | "menu"
    | "accounts"
    | "categories"
    | "export"
    | "import"
    | "backup"
    | "appearance"
    | "support"
    | "danger";

const CONFIG_SECTION_TITLES: Record<Exclude<ConfigSection, "menu">, string> = {
    accounts: "Accounts",
    categories: "Categories",
    export: "Export",
    import: "Import",
    backup: "Backup",
    appearance: "Appearance",
    support: "Contact support",
    danger: "Delete data",
};

const SUPPORT_EMAIL = "jan@janrosell.com";

function SegmentedButton({
    active,
    onClick,
    children,
    className = "",
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 rounded-xl py-3 font-bold transition-colors duration-150 select-none ${
                active ? "bg-ink text-paper" : "bg-chip text-muted hover:bg-chip-hover"
            } ${className}`}
        >
            {children}
        </button>
    );
}

export function ConfigView({
    accounts,
    categories,
    appearance,
    onPatchAppearance,
    onRefresh,
    onLogout,
    onPasswordChanged,
    onImported,
    onAccountDeleted,
    onOpenTour,
    showFinishSetup,
    onOpenSetup,
}: {
    accounts: Account[];
    categories: Category[];
    appearance: AppearancePrefs;
    onPatchAppearance: (partial: Partial<AppearancePrefs>) => void;
    onRefresh: () => void;
    onLogout: () => void;
    onPasswordChanged: () => void;
    onImported: () => void;
    onAccountDeleted: () => void;
    onOpenTour: () => void;
    showFinishSetup: boolean;
    onOpenSetup: () => void;
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
                `Delete “${a.name}”? This also deletes every transaction linked to it (as source or destination). This cannot be undone.`
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
                onRefresh();
            },
        });
    }

    async function handleDeleteAllTransactions() {
        if (
            !confirm(
                "Delete all transactions and reset every account’s initial balance to 0? Accounts and categories stay. This cannot be undone."
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
                "Permanently delete your MyFinance login and all of your data (accounts, categories, transactions, to-dos)? You will be logged out. This cannot be undone."
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
        onRefresh();
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
        onRefresh();
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
                <div>
                    <h1 className="text-2xl font-extrabold text-ink">Settings</h1>
                    <p className="mt-1 text-sm text-muted">Accounts, data, look &amp; feel, and account safety.</p>
                </div>

                {error && <p className="text-sm font-medium text-danger">{error}</p>}

                <div className="overflow-hidden surface rounded-2xl">
                    <MenuRow label="Bank accounts" onClick={() => setSection("accounts")} />
                    <MenuRow label="Categories" onClick={() => setSection("categories")} />
                    <MenuRow label="Export" onClick={() => setSection("export")} />
                    <MenuRow label="Import" onClick={() => setSection("import")} />
                    <MenuRow label="Backup" onClick={() => setSection("backup")} />
                    <MenuRow label="Appearance" onClick={() => setSection("appearance")} />
                </div>

                <div className="overflow-hidden surface rounded-2xl">
                    {showFinishSetup && (
                        <MenuRow label="Finish setup" onClick={onOpenSetup} />
                    )}
                    <MenuRow label="App tour" onClick={onOpenTour} />
                    <MenuRow label="Contact support" onClick={() => setSection("support")} />
                    <MenuRow label="Change password" chevron={false} last onClick={() => setShowChangePassword(true)} />
                </div>

                <div className="overflow-hidden surface rounded-2xl">
                    <MenuRow label="Delete data" danger onClick={() => setSection("danger")} />
                    <MenuRow label="Log out" chevron={false} danger last onClick={onLogout} />
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
                    aria-label="Back to settings"
                    className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                >
                    <IconArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-extrabold text-ink">{CONFIG_SECTION_TITLES[section]}</h1>
            </div>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {section === "accounts" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <div className="space-y-2 text-sm text-muted">
                        <p>
                            Accounts are the wallets and bank accounts you track. Balances start from the{" "}
                            <span className="font-semibold text-ink">initial balance</span>, then move with every
                            income, expense, and transfer.
                        </p>
                        <ul className="list-disc space-y-1.5 pl-5">
                            <li>
                                <IconRadioDot className="inline h-3.5 w-3.5 -translate-y-0.5" /> Default account —
                                pre-selected when you add a transaction.
                            </li>
                            <li>Icon — shown on Home and in lists.</li>
                            <li>
                                <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> Rename — updates
                                everywhere automatically.
                            </li>
                            <li>
                                Initial balance — set this if the account already had money when you started tracking
                                it (instead of inventing an income transaction).
                            </li>
                            <li>Delete — removes the account and all transactions linked to it.</li>
                        </ul>
                    </div>
                    <AccountList
                        items={accounts}
                        privacyMode={appearance.privacyMode}
                        onRename={handleRenameAccount}
                        onSetInitialBalance={handleSetInitialBalance}
                        onSetDefault={handleSetDefaultAccount}
                        onSetIcon={handleSetAccountIcon}
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
                            placeholder="Initial balance (optional, default 0)"
                            className={INPUT_CLS}
                        />
                        <button type="submit" disabled={savingAccount} className={`${PRIMARY_BTN} w-full`}>
                            Add account
                        </button>
                    </form>
                </section>
            )}

            {section === "categories" && (
                <section className="space-y-5 surface rounded-2xl p-5">
                    <div className="space-y-2 text-sm text-muted">
                        <p>
                            Categories label income and expenses (transfers go between accounts, not categories).
                            Colour and icon appear on transactions and in Analytics.
                        </p>
                        <ul className="list-disc space-y-1.5 pl-5">
                            <li>
                                <IconGrip className="inline h-3.5 w-3.5 -translate-y-0.5" /> Drag to reorder — order is
                                used in pickers.
                            </li>
                            <li>
                                <IconRadioDot className="inline h-3.5 w-3.5 -translate-y-0.5" /> Default for that type —
                                pre-selected when adding a transaction.
                            </li>
                            <li>Colour / icon — tap the swatch or icon to change.</li>
                            <li>
                                <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> Rename — existing
                                transactions keep the same category (name updates everywhere).
                            </li>
                            <li>Delete — removes the category and its transactions (with a short undo window).</li>
                        </ul>
                    </div>
                    <CategoryList
                        title="Income"
                        type="income"
                        items={categories.filter((c) => c.type === "income" && !pendingDeleteCategoryIds.has(c.id))}
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
                        items={categories.filter((c) => c.type === "expense" && !pendingDeleteCategoryIds.has(c.id))}
                        onReorder={handleReorderCategories}
                        onSetDefault={handleSetDefault}
                        onSetColor={handleSetCategoryColor}
                        onSetIcon={handleSetCategoryIcon}
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
                            Add category
                        </button>
                    </form>
                </section>
            )}

            {section === "export" && <ExportView accounts={accounts} categories={categories} />}

            {section === "import" && (
                <ImportView accounts={accounts} categories={categories} onImported={onImported} />
            )}

            {section === "backup" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <div className="space-y-2 text-sm text-muted">
                        <p>
                            Download a full JSON snapshot of your accounts, categories, transactions, to-dos, and
                            appearance preferences.
                        </p>
                        <p>
                            This is for your own safekeeping. It is not the same as{" "}
                            <span className="font-semibold text-ink">Export</span> (spreadsheet/TSV for Excel). There is
                            no one-click restore in the app yet — keep the file somewhere safe if you want a recoverable
                            copy.
                        </p>
                    </div>
                    <a href="/api/backup" className={`${PRIMARY_BTN} block w-full text-center`}>
                        Download backup
                    </a>
                </section>
            )}

            {section === "appearance" && (
                <section className="space-y-6 surface rounded-2xl p-5">
                    <p className="text-sm text-muted">
                        These choices are saved to your account and apply on every device where you sign in.
                    </p>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Theme</p>
                        <p className="text-xs text-muted">Light or dark. Not tied to your phone’s system setting.</p>
                        <div className="flex gap-2">
                            <SegmentedButton
                                active={appearance.theme === "light"}
                                onClick={() => onPatchAppearance({ theme: "light" })}
                            >
                                Light
                            </SegmentedButton>
                            <SegmentedButton
                                active={appearance.theme === "dark"}
                                onClick={() => onPatchAppearance({ theme: "dark" })}
                            >
                                Dark
                            </SegmentedButton>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Accent colour</p>
                        <p className="text-xs text-muted">Primary buttons, highlights, and focus rings.</p>
                        <div className="flex flex-wrap gap-2.5">
                            {ACCENT_COLORS.map((c) => {
                                const selected = appearance.accent === c.key;
                                return (
                                    <button
                                        key={c.key}
                                        type="button"
                                        aria-label={c.label}
                                        aria-pressed={selected}
                                        title={c.label}
                                        onClick={() => onPatchAppearance({ accent: c.key })}
                                        className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-95 ${
                                            selected ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""
                                        }`}
                                        style={{ backgroundColor: c.swatch }}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Currency</p>
                        <p className="text-xs text-muted">
                            Display only — amounts are stored as numbers. Changing currency does not convert values.
                        </p>
                        <div className="flex flex-col gap-2">
                            {CURRENCY_OPTIONS.map((c) => (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => onPatchAppearance({ currency: c.key })}
                                    className={`rounded-xl px-4 py-3 text-left font-bold transition-colors duration-150 select-none ${
                                        appearance.currency === c.key
                                            ? "bg-ink text-paper"
                                            : "bg-chip text-muted hover:bg-chip-hover hover:text-ink"
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Date format</p>
                        <p className="text-xs text-muted">
                            How dates appear in the app. Import still expects DD/MM/YYYY when pasting from a sheet.
                        </p>
                        <div className="flex flex-col gap-2">
                            {DATE_FORMAT_OPTIONS.map((d) => (
                                <button
                                    key={d.key}
                                    type="button"
                                    onClick={() => onPatchAppearance({ dateFormat: d.key })}
                                    className={`rounded-xl px-4 py-3 text-left font-bold transition-colors duration-150 select-none ${
                                        appearance.dateFormat === d.key
                                            ? "bg-ink text-paper"
                                            : "bg-chip text-muted hover:bg-chip-hover hover:text-ink"
                                    }`}
                                >
                                    {d.label}
                                    <span className="mt-0.5 block text-xs font-semibold opacity-70">{d.example}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Privacy</p>
                        <button
                            type="button"
                            onClick={() => onPatchAppearance({ privacyMode: !appearance.privacyMode })}
                            aria-pressed={appearance.privacyMode}
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 font-bold transition-colors duration-150 select-none ${
                                appearance.privacyMode
                                    ? "bg-brand/10 text-brand"
                                    : "bg-chip text-muted hover:bg-chip-hover hover:text-ink"
                            }`}
                        >
                            <span>Hide amounts</span>
                            <span className="text-xs font-semibold opacity-80">
                                {appearance.privacyMode ? "On" : "Off"}
                            </span>
                        </button>
                        <p className="text-xs text-muted">
                            Same as the eye in the header. Blurs balances and amounts; it does not lock the app.
                        </p>
                    </div>
                </section>
            )}

            {section === "support" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <p className="text-sm text-muted">
                        Need help, found a bug, or have an idea? Write to the developer and maintainer of MyFinance.
                    </p>
                    <div className="rounded-xl bg-chip px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p>
                        <a
                            href={`mailto:${SUPPORT_EMAIL}?subject=MyFinance%20support`}
                            className="mt-1 block text-base font-bold text-brand break-all"
                        >
                            {SUPPORT_EMAIL}
                        </a>
                    </div>
                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=MyFinance%20support`}
                        className={`${PRIMARY_BTN} block w-full text-center`}
                    >
                        Write an email
                    </a>
                    <p className="text-xs text-muted">
                        Include what you were doing and roughly when it happened — that makes replies much faster.
                    </p>
                </section>
            )}

            {section === "danger" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <p className="text-sm text-muted">
                        Destructive actions. Prefer a <span className="font-semibold text-ink">Backup</span> first if
                        you might want the data later.
                    </p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={handleDeleteAllTransactions}
                            className={`${DANGER_BTN} w-full`}
                        >
                            Delete all transactions
                        </button>
                        <p className="text-xs text-muted">
                            Clears every transaction and sets all initial balances to 0. Accounts and categories remain.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <button type="button" onClick={handleDeleteMyAccount} className={`${DANGER_BTN} w-full`}>
                            Delete my account
                        </button>
                        <p className="text-xs text-muted">
                            Removes your login and all personal data from this app. You will be signed out immediately.
                        </p>
                    </div>
                </section>
            )}
        </div>
    );
}
