"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { LANGUAGE_OPTIONS, type TFunction } from "@/i18n";
import { useT } from "@/i18n/I18nProvider";
import {
    type Account,
    type AccentColor,
    type AppearancePrefs,
    type Category,
    type CurrencyCode,
    ACCENT_COLORS,
    CURRENCY_OPTIONS,
    DANGER_BTN,
    DATE_FORMAT_OPTIONS,
    INK_BTN,
    INPUT_CLS,
    parseAmountEs,
    PRIMARY_BTN,
    SUPPORT_EMAIL,
    SUPPORT_TOPICS,
    type SupportTopic,
} from "../shared";
import { AccountList } from "./AccountList";
import { CategoryList } from "./CategoryList";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ExportView } from "./ExportView";
import { ImportView } from "./ImportView";
import { AdminView } from "./AdminView";
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
    | "admin"
    | "danger";

function configSectionTitles(t: TFunction): Record<Exclude<ConfigSection, "menu">, string> {
    return {
        accounts: t("settings.sectionAccounts"),
        categories: t("settings.sectionCategories"),
        export: t("settings.sectionExport"),
        import: t("settings.sectionImport"),
        backup: t("settings.sectionBackup"),
        appearance: t("settings.sectionAppearance"),
        support: t("settings.sectionSupport"),
        admin: t("settings.sectionAdmin"),
        danger: t("settings.sectionDanger"),
    };
}

function emphasize(template: string, label: string) {
    const [before, after = ""] = template.split("\0");
    return (
        <>
            {before}
            <span className="font-semibold text-ink">{label}</span>
            {after}
        </>
    );
}

function accentLabel(key: AccentColor, t: TFunction) {
    switch (key) {
        case "green":
            return t("appearance.accentGreen");
        case "blue":
            return t("appearance.accentBlue");
        case "terracotta":
            return t("appearance.accentTerracotta");
        case "slate":
            return t("appearance.accentSlate");
        case "rose":
            return t("appearance.accentRose");
    }
}

function currencyLabel(key: CurrencyCode, t: TFunction) {
    switch (key) {
        case "EUR":
            return t("appearance.currencyEUR");
        case "USD":
            return t("appearance.currencyUSD");
        case "GBP":
            return t("appearance.currencyGBP");
    }
}

function supportTopicLabel(topic: SupportTopic, t: TFunction) {
    switch (topic) {
        case "Help":
            return t("support.topicHelp");
        case "Bug":
            return t("support.topicBug");
        case "Idea":
            return t("support.topicIdea");
    }
}

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
    username,
    isAdmin,
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
    username: string;
    isAdmin: boolean;
}) {
    const t = useT();
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
    const [supportEmail, setSupportEmail] = useState("");
    const [supportTopic, setSupportTopic] = useState<SupportTopic>("Help");
    const [supportMessage, setSupportMessage] = useState("");
    const [supportSending, setSupportSending] = useState(false);
    const [supportStatus, setSupportStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const { requestDelete } = useUndoToast();

    async function handleAddAccount(e: FormEvent) {
        e.preventDefault();
        if (!accountName.trim()) return;
        const trimmedBalance = accountInitialBalance.trim();
        const initialBalance = trimmedBalance ? parseAmountEs(trimmedBalance) : 0;
        if (initialBalance === null) {
            setError(t("accounts.invalidBalance"));
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
                setError(data.error || t("accounts.addFailed"));
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
            setError(t("accounts.invalidBalance"));
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
            setError(data.error || t("accounts.updateBalanceFailed"));
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
            setError(data.error || t("accounts.renameFailed"));
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
                setError(data.error || t("categories.addFailed"));
                return;
            }
            setCategoryName("");
            onRefresh();
        } finally {
            setSavingCategory(false);
        }
    }

    async function handleDeleteAccount(a: Account) {
        if (!confirm(t("accounts.deleteConfirm", { name: a.name }))) {
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
            setError(data.error || t("accounts.deleteFailed"));
            return;
        }
        onRefresh();
    }

    function handleDeleteCategory(c: Category) {
        setError("");
        setPendingDeleteCategoryIds((prev) => new Set(prev).add(c.id));
        requestDelete({
            message: t("categories.deleted", { name: c.name }),
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
                if (!res.ok) setError(data.error || t("categories.deleteFailed"));
                setPendingDeleteCategoryIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c.id);
                    return next;
                });
                onRefresh();
            },
        });
    }

    async function handleSupportSubmit(e: FormEvent) {
        e.preventDefault();
        const email = supportEmail.trim();
        const message = supportMessage.trim();
        setSupportStatus(null);

        if (!email || !message) {
            setSupportStatus({ type: "error", text: t("support.fillFields") });
            return;
        }

        setSupportSending(true);
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, topic: supportTopic, message }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setSupportStatus({ type: "error", text: data.error || t("support.sendFailed") });
                return;
            }
            setSupportMessage("");
            setSupportStatus({ type: "success", text: t("support.sent") });
        } catch {
            setSupportStatus({ type: "error", text: t("common.networkError") });
        } finally {
            setSupportSending(false);
        }
    }

    async function handleDeleteAllTransactions() {
        if (!confirm(t("danger.deleteAllTxConfirm"))) {
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
            setError(data.error || t("danger.deleteAllFailed"));
            return;
        }
        onRefresh();
    }

    async function handleDeleteMyAccount() {
        if (!confirm(t("danger.deleteAccountConfirm"))) {
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
            setError(data.error || t("danger.deleteAccountFailed"));
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
            setError(data.error || t("categories.reorderFailed"));
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
            setError(data.error || t("accounts.defaultFailed"));
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
            setError(data.error || t("accounts.iconFailed"));
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
            setError(data.error || t("categories.defaultFailed"));
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
            setError(data.error || t("categories.colorFailed"));
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
            setError(data.error || t("categories.iconFailed"));
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
            setError(data.error || t("categories.renameFailed"));
            return;
        }
        onRefresh();
    }

    if (section === "menu") {
        return (
            <div className="space-y-6 px-5 pt-6">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">{t("settings.title")}</h1>
                    {/* <p className="mt-1 text-sm text-muted">Accounts, data, look &amp; feel, and account safety.</p> */}
                </div>

                {error && <p className="text-sm font-medium text-danger">{error}</p>}

                <div className="overflow-hidden surface rounded-2xl">
                    <MenuRow label={t("settings.bankAccounts")} onClick={() => setSection("accounts")} />
                    <MenuRow label={t("settings.categories")} onClick={() => setSection("categories")} />
                    <MenuRow label={t("settings.export")} onClick={() => setSection("export")} />
                    <MenuRow label={t("settings.import")} onClick={() => setSection("import")} />
                    <MenuRow label={t("settings.backup")} onClick={() => setSection("backup")} />
                    <MenuRow label={t("settings.appearance")} onClick={() => setSection("appearance")} />
                </div>

                <div className="overflow-hidden surface rounded-2xl">
                    {showFinishSetup && (
                        <MenuRow label={t("settings.finishSetup")} onClick={onOpenSetup} />
                    )}
                    <MenuRow label={t("settings.appTour")} onClick={onOpenTour} />
                    <MenuRow label={t("settings.contactSupport")} onClick={() => setSection("support")} />
                    <MenuRow label={t("settings.changePassword")} chevron={false} last onClick={() => setShowChangePassword(true)} />
                </div>

                {isAdmin && (
                    <div className="overflow-hidden surface rounded-2xl">
                        <MenuRow label={t("settings.admin")} last onClick={() => setSection("admin")} />
                    </div>
                )}

                <div className="overflow-hidden surface rounded-2xl">
                    <MenuRow label={t("settings.deleteData")} danger onClick={() => setSection("danger")} />
                    <MenuRow label={t("settings.logOut")} chevron={false} danger last onClick={onLogout} />
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
                    aria-label={t("settings.backToSettings")}
                    className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                >
                    <IconArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-semibold text-ink">{configSectionTitles(t)[section]}</h1>
            </div>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {section === "accounts" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <div className="space-y-2 text-sm text-muted">
                        <p>
                            {emphasize(
                                t("accounts.intro", { initialBalance: "\0" }),
                                t("accounts.initialBalance"),
                            )}
                        </p>
                        <ul className="list-disc space-y-1.5 pl-5">
                            <li>
                                <IconRadioDot className="inline h-3.5 w-3.5 -translate-y-0.5" /> {t("accounts.bulletDefault")}
                            </li>
                            <li>{t("accounts.bulletIcon")}</li>
                            <li>
                                <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> {t("accounts.bulletRename")}
                            </li>
                            <li>{t("accounts.bulletBalance")}</li>
                            <li>{t("accounts.bulletDelete")}</li>
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
                            placeholder={t("accounts.namePlaceholder")}
                            className={INPUT_CLS}
                        />
                        <input
                            value={accountInitialBalance}
                            onChange={(e) => setAccountInitialBalance(e.target.value)}
                            inputMode="decimal"
                            placeholder={t("accounts.balancePlaceholder")}
                            className={INPUT_CLS}
                        />
                        <button type="submit" disabled={savingAccount} className={`${PRIMARY_BTN} w-full`}>
                            {t("accounts.add")}
                        </button>
                    </form>
                </section>
            )}

            {section === "categories" && (
                <section className="space-y-5 surface rounded-2xl p-5">
                    <div className="space-y-2 text-sm text-muted">
                        <p>{t("categories.intro")}</p>
                        <ul className="list-disc space-y-1.5 pl-5">
                            <li>
                                <IconGrip className="inline h-3.5 w-3.5 -translate-y-0.5" /> {t("categories.bulletReorder")}
                            </li>
                            <li>
                                <IconRadioDot className="inline h-3.5 w-3.5 -translate-y-0.5" /> {t("categories.bulletDefault")}
                            </li>
                            <li>{t("categories.bulletStyle")}</li>
                            <li>
                                <IconPencil className="inline h-3.5 w-3.5 -translate-y-0.5" /> {t("categories.bulletRename")}
                            </li>
                            <li>{t("categories.bulletDelete")}</li>
                        </ul>
                    </div>
                    <CategoryList
                        title={t("type.income")}
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
                        title={t("type.expense")}
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
                            placeholder={t("categories.namePlaceholder")}
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
                                {t("type.income")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryType("expense")}
                                className={`flex-1 rounded-xl py-3 font-bold transition-colors duration-150 select-none ${
                                    categoryType === "expense" ? "bg-danger text-white" : "bg-chip text-muted hover:bg-chip-hover"
                                }`}
                            >
                                {t("type.expense")}
                            </button>
                        </div>
                        <button type="submit" disabled={savingCategory} className={`${INK_BTN} w-full`}>
                            {t("categories.add")}
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
                        <p>{t("backup.intro")}</p>
                        <p>
                            {emphasize(t("backup.notExport", { export: "\0" }), t("backup.exportWord"))}
                        </p>
                    </div>
                    <a href="/api/backup" className={`${PRIMARY_BTN} block w-full text-center`}>
                        {t("backup.download")}
                    </a>
                </section>
            )}

            {section === "appearance" && (
                <section className="space-y-6 surface rounded-2xl p-5">
                    <p className="text-sm text-muted">{t("appearance.intro")}</p>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("appearance.language")}</p>
                        <p className="text-xs text-muted">{t("appearance.languageHint")}</p>
                        <div className="flex flex-col gap-2">
                            {LANGUAGE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => onPatchAppearance({ language: opt.key })}
                                    className={`rounded-xl px-4 py-3 text-left font-bold transition-colors duration-150 select-none ${
                                        appearance.language === opt.key
                                            ? "bg-ink text-paper"
                                            : "bg-chip text-muted hover:bg-chip-hover hover:text-ink"
                                    }`}
                                >
                                    {opt.nativeName}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("appearance.theme")}</p>
                        <p className="text-xs text-muted">{t("appearance.themeHint")}</p>
                        <div className="flex gap-2">
                            <SegmentedButton
                                active={appearance.theme === "light"}
                                onClick={() => onPatchAppearance({ theme: "light" })}
                            >
                                {t("appearance.light")}
                            </SegmentedButton>
                            <SegmentedButton
                                active={appearance.theme === "dark"}
                                onClick={() => onPatchAppearance({ theme: "dark" })}
                            >
                                {t("appearance.dark")}
                            </SegmentedButton>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("appearance.accent")}</p>
                        <p className="text-xs text-muted">{t("appearance.accentHint")}</p>
                        <div className="flex flex-wrap gap-2.5">
                            {ACCENT_COLORS.map((c) => {
                                const selected = appearance.accent === c.key;
                                const label = accentLabel(c.key, t);
                                return (
                                    <button
                                        key={c.key}
                                        type="button"
                                        aria-label={label}
                                        aria-pressed={selected}
                                        title={label}
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
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("appearance.currency")}</p>
                        <p className="text-xs text-muted">{t("appearance.currencyHint")}</p>
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
                                    {currencyLabel(c.key, t)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("appearance.dateFormat")}</p>
                        <p className="text-xs text-muted">{t("appearance.dateFormatHint")}</p>
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
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("appearance.privacy")}</p>
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
                            <span>{t("appearance.hideAmounts")}</span>
                            <span className="text-xs font-semibold opacity-80">
                                {appearance.privacyMode ? t("common.on") : t("common.off")}
                            </span>
                        </button>
                        <p className="text-xs text-muted">{t("appearance.privacyHint")}</p>
                    </div>
                </section>
            )}

            {section === "support" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <p className="text-sm text-muted">{t("support.intro")}</p>
                    <form onSubmit={handleSupportSubmit} className="space-y-4">
                        <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                                {t("support.yourEmail")}
                            </span>
                            <input
                                type="email"
                                value={supportEmail}
                                onChange={(e) => setSupportEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className={INPUT_CLS}
                            />
                        </label>
                        <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("support.topic")}</p>
                            <div className="flex gap-2">
                                {SUPPORT_TOPICS.map((topic) => (
                                    <SegmentedButton
                                        key={topic}
                                        active={supportTopic === topic}
                                        onClick={() => setSupportTopic(topic)}
                                    >
                                        {supportTopicLabel(topic, t)}
                                    </SegmentedButton>
                                ))}
                            </div>
                        </div>
                        <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                                {t("support.message")}
                            </span>
                            <textarea
                                value={supportMessage}
                                onChange={(e) => setSupportMessage(e.target.value)}
                                required
                                rows={5}
                                maxLength={2000}
                                placeholder={t("support.messagePlaceholder")}
                                className={`${INPUT_CLS} resize-y`}
                            />
                        </label>
                        {supportStatus && (
                            <p
                                role="status"
                                className={`text-sm font-medium ${
                                    supportStatus.type === "success" ? "text-brand" : "text-danger"
                                }`}
                            >
                                {supportStatus.text}
                            </p>
                        )}
                        <button type="submit" disabled={supportSending} className={`${PRIMARY_BTN} w-full`}>
                            {supportSending ? t("support.sending") : t("support.send")}
                        </button>
                    </form>
                    <p className="text-xs text-muted">
                        {t("support.orEmail")}{" "}
                        <a
                            href={`mailto:${SUPPORT_EMAIL}?subject=MyFinance%20support`}
                            className="font-medium text-brand transition-colors duration-150 hover:text-brand-dark"
                        >
                            {SUPPORT_EMAIL}
                        </a>
                    </p>
                </section>
            )}

            {section === "admin" && isAdmin && <AdminView currentUsername={username} />}

            {section === "danger" && (
                <section className="space-y-4 surface rounded-2xl p-5">
                    <p className="text-sm text-muted">
                        {emphasize(t("danger.intro", { backup: "\0" }), t("danger.backupWord"))}
                    </p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={handleDeleteAllTransactions}
                            className={`${DANGER_BTN} w-full`}
                        >
                            {t("danger.deleteAllTx")}
                        </button>
                        <p className="text-xs text-muted">{t("danger.deleteAllTxHint")}</p>
                    </div>
                    <div className="space-y-2">
                        <button type="button" onClick={handleDeleteMyAccount} className={`${DANGER_BTN} w-full`}>
                            {t("danger.deleteAccount")}
                        </button>
                        <p className="text-xs text-muted">{t("danger.deleteAccountHint")}</p>
                    </div>
                </section>
            )}
        </div>
    );
}
