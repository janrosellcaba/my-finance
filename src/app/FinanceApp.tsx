"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnalyticsView } from "./AnalyticsView";
import {
    type Account,
    type Category,
    AMOUNT_MASK,
    CATEGORY_COLOR_PALETTE,
    eur,
    formatCurrency,
    formatDate,
    INPUT_CLS,
    INK_BTN,
    PRIMARY_BTN,
} from "./shared";
import { ImportView } from "./ImportView";
import { ExportView } from "./ExportView";

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
type DashboardSummary = {
    totalNetWorth: number;
    accounts: { id: string; name: string; balance: number }[];
    recentTransactions: Transaction[];
};
type Tab = "home" | "transactions" | "analytics" | "config";

function resolveName(id: string, accounts: Account[], categories: Category[]): string {
    return accounts.find((a) => a.id === id)?.name ?? categories.find((c) => c.id === id)?.name ?? "Unknown";
}

// ---------- Icons ----------

function IconHome({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11.5 12 4l8 7.5" />
            <path d="M6 10.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-8.5" />
        </svg>
    );
}

function IconList({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M8 9h8M8 12.5h8M8 16h5" />
        </svg>
    );
}

function IconSettings({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
            <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="9" cy="6" r="2.1" fill="currentColor" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="15" cy="12" r="2.1" fill="currentColor" />
            <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="7" cy="18" r="2.1" fill="currentColor" />
        </svg>
    );
}

function IconClose({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    );
}

function IconEye({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function IconEyeOff({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a13.5 13.5 0 0 1-3.1 3.9M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.4-.9" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
    );
}

function IconChart({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="12" width="4" height="8" rx="1" />
            <rect x="10" y="8" width="4" height="12" rx="1" />
            <rect x="16" y="4" width="4" height="16" rx="1" />
        </svg>
    );
}

function IconChevronRight({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
        </svg>
    );
}

function IconArrowLeft({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
    );
}

function IconFilter({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16M7 12h10M10 19h4" />
        </svg>
    );
}

function IconRadioDot({ className, checked }: { className?: string; checked?: boolean }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8" />
            {checked && <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />}
        </svg>
    );
}

function IconPencil({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            <path d="M14.5 5.5l3 3" />
        </svg>
    );
}

function IconGrip({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
            <circle cx="9" cy="6" r="1.4" />
            <circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" />
            <circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" />
            <circle cx="15" cy="18" r="1.4" />
        </svg>
    );
}

// ---------- Auth ----------

export function AuthGate() {
    const router = useRouter();
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [secretCode, setSecretCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
        const payload = mode === "login" ? { username, password } : { username, password, secretCode };

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Something went wrong.");
                setLoading(false);
                return;
            }
            router.refresh();
        } catch {
            setError("Network error. Please try again.");
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-cream px-5">
            <div className="w-full max-w-sm rounded-3xl border border-line bg-paper p-8 shadow-sm">
                <div className="mb-3 flex justify-center">
                    <Image src="/logo.png" alt="" width={52} height={52} priority className="opacity-90" />
                </div>
                <h1 className="text-center text-3xl font-extrabold tracking-tight text-ink">MyFinance</h1>
                <p className="mb-6 text-center text-sm text-muted">
                    {mode === "login" ? "Welcome back." : "Create your account."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-ink">Username</span>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            minLength={3}
                            autoComplete="username"
                            className={INPUT_CLS}
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-ink">Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={1}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                            className={INPUT_CLS}
                        />
                    </label>

                    {mode === "signup" && (
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-ink">Registration Safety Code</span>
                            <input value={secretCode} onChange={(e) => setSecretCode(e.target.value)} required className={INPUT_CLS} />
                        </label>
                    )}

                    {error && <p className="text-sm font-medium text-danger">{error}</p>}

                    <button type="submit" disabled={loading} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                        {loading ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => {
                        setMode(mode === "login" ? "signup" : "login");
                        setError("");
                    }}
                    className="mt-5 w-full text-center text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
                >
                    {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
                </button>
            </div>
        </div>
    );
}

// ---------- App shell ----------

export function AppShell({ username, initialPrivacyMode }: { username: string; initialPrivacyMode: boolean }) {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("home");
    const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [privacyMode, setPrivacyMode] = useState(initialPrivacyMode);
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        mainRef.current?.scrollTo(0, 0);
    }, [tab]);

    const loadDashboard = useCallback(async () => {
        const res = await fetch("/api/dashboard");
        if (res.status === 401) {
            router.refresh();
            return;
        }
        const data = (await res.json()) as { success: boolean; summary?: DashboardSummary };
        if (data.success && data.summary) setDashboard(data.summary);
        setLoadingDashboard(false);
    }, [router]);

    const loadConfig = useCallback(async () => {
        const res = await fetch("/api/config");
        if (res.status === 401) {
            router.refresh();
            return;
        }
        const data = (await res.json()) as { success: boolean; accounts?: Account[]; categories?: Category[] };
        if (data.success) {
            setAccounts(data.accounts ?? []);
            setCategories(data.categories ?? []);
        }
    }, [router]);

    useEffect(() => {
        loadDashboard();
        loadConfig();
    }, [loadDashboard, loadConfig]);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
    }

    async function handlePasswordChanged() {
        router.refresh();
    }

    async function handleAccountDeleted() {
        router.refresh();
    }

    async function handleTransactionSaved() {
        setShowAddModal(false);
        await loadDashboard();
    }

    async function handleTogglePrivacy() {
        const next = !privacyMode;
        setPrivacyMode(next);
        const res = await fetch("/api/privacy", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ privacyMode: next }),
        });
        if (!res.ok) setPrivacyMode(!next);
    }

    return (
        <div className="flex h-dvh flex-col bg-cream">
            <header className="shrink-0 border-b border-line bg-paper/90 px-5 py-4 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="" width={20} height={20} className="opacity-80" />
                        <p className="text-lg font-extrabold text-ink">Hi, {username}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleTogglePrivacy}
                        aria-label={privacyMode ? "Show amounts" : "Hide amounts"}
                        aria-pressed={privacyMode}
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        {privacyMode ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                    </button>
                </div>
            </header>

            <main ref={mainRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                <div className="mx-auto max-w-md pb-6">
                    {tab === "home" && (
                        <HomeView
                            dashboard={dashboard}
                            loading={loadingDashboard}
                            accounts={accounts}
                            categories={categories}
                            privacyMode={privacyMode}
                            onAddClick={() => setShowAddModal(true)}
                        />
                    )}
                    {tab === "transactions" && (
                        <TransactionsView
                            accounts={accounts}
                            categories={categories}
                            privacyMode={privacyMode}
                            onTransactionChanged={loadDashboard}
                        />
                    )}
                    {tab === "analytics" && <AnalyticsView privacyMode={privacyMode} />}
                    {tab === "config" && (
                        <ConfigView
                            accounts={accounts}
                            categories={categories}
                            onRefresh={loadConfig}
                            onLogout={handleLogout}
                            onPasswordChanged={handlePasswordChanged}
                            onAccountDeleted={handleAccountDeleted}
                            onImported={async () => {
                                await Promise.all([loadConfig(), loadDashboard()]);
                            }}
                        />
                    )}
                </div>
            </main>

            <BottomNav active={tab} onChange={setTab} />

            {showAddModal && (
                <AddTransactionModal
                    accounts={accounts}
                    categories={categories}
                    onClose={() => setShowAddModal(false)}
                    onSaved={handleTransactionSaved}
                />
            )}
        </div>
    );
}

// ---------- Bottom navigation ----------

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
    const items: { key: Tab; label: string; Icon: (props: { className?: string }) => ReactElement }[] = [
        { key: "home", label: "Home", Icon: IconHome },
        { key: "transactions", label: "Transactions", Icon: IconList },
        { key: "analytics", label: "Analytics", Icon: IconChart },
        { key: "config", label: "Settings", Icon: IconSettings },
    ];

    return (
        <nav className="shrink-0 border-t border-line bg-paper/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-md">
                {items.map(({ key, label, Icon }) => {
                    const isActive = active === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChange(key)}
                            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-bold transition-all duration-150 select-none ${
                                isActive ? "text-brand" : "text-muted hover:-translate-y-0.5 hover:text-ink"
                            }`}
                        >
                            <Icon className="h-6 w-6" />
                            {label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

// ---------- Home / Dashboard ----------

function HomeView({
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

function TransactionCard({
    tx,
    accounts,
    categories,
    privacyMode,
    onClick,
    compact = false,
}: {
    tx: Transaction;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onClick?: () => void;
    compact?: boolean;
}) {
    const sign = tx.type === "expense" ? "-" : tx.type === "income" ? "+" : "";
    const color = tx.type === "expense" ? "text-danger" : tx.type === "income" ? "text-brand" : "text-ink";
    const fromName = resolveName(tx.accountId, accounts, categories);
    const toName = resolveName(tx.destinationId, accounts, categories);
    const subtitle = tx.type === "transfer" ? `${fromName} → ${toName}` : `${toName} · ${fromName}`;
    const categoryColor =
        tx.type !== "transfer" ? categories.find((c) => c.id === tx.destinationId)?.color ?? null : null;
    const Tag = onClick ? "button" : "div";

    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            style={categoryColor ? { backgroundColor: categoryColor } : undefined}
            className={
                compact
                    ? `flex w-full items-center justify-between px-4 py-2.5 text-left ${
                          onClick ? "transition-colors duration-150 hover:bg-chip" : ""
                      }`
                    : `flex w-full items-center justify-between rounded-2xl border border-line bg-paper p-4 text-left shadow-sm ${
                          onClick ? "transition-colors duration-150 hover:border-brand hover:bg-chip" : ""
                      }`
            }
        >
            <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{tx.description}</p>
                <p className="truncate text-xs text-muted">
                    {subtitle} · {formatDate(tx.date)}
                </p>
            </div>
            <p className={`ml-3 shrink-0 font-bold ${compact ? "text-base" : "text-lg"} ${color}`}>
                {privacyMode ? AMOUNT_MASK : `${sign}${eur.format(Math.abs(tx.amount))}`}
            </p>
        </Tag>
    );
}

// ---------- Add transaction modal ----------

function AddTransactionModal({
    accounts,
    categories,
    transaction,
    onClose,
    onSaved,
}: {
    accounts: Account[];
    categories: Category[];
    transaction?: Transaction;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEditing = !!transaction;

    function defaultCategoryFor(t: "income" | "expense"): string {
        return categories.find((c) => c.type === t && c.isDefault)?.id ?? "";
    }

    const [date, setDate] = useState(() => transaction?.date ?? new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState(transaction?.description ?? "");
    const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
    const [accountId, setAccountId] = useState(transaction?.accountId ?? "");
    const [destinationId, setDestinationId] = useState(transaction ? transaction.destinationId : defaultCategoryFor("expense"));
    const [amount, setAmount] = useState(transaction ? String(Math.abs(transaction.amount)) : "");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const destinationOptions: { id: string; name: string }[] =
        type === "transfer" ? accounts.filter((a) => a.id !== accountId) : categories.filter((c) => c.type === type);

    function handleTypeChange(next: TransactionType) {
        setType(next);
        setDestinationId(isEditing || next === "transfer" ? "" : defaultCategoryFor(next));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        const amountNum = parseFloat(amount);

        if (!date) {
            setError("Please fill in the date.");
            return;
        }
        if (!accountId) {
            setError("Please choose an account.");
            return;
        }
        if (!destinationId) {
            setError(type === "transfer" ? "Please choose a destination account." : "Please choose a category.");
            return;
        }
        if (type === "transfer" && accountId === destinationId) {
            setError("Source and destination accounts must be different.");
            return;
        }
        if (!amountNum || amountNum <= 0) {
            setError("Please enter an amount greater than zero.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/transactions", {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(isEditing ? { id: transaction!.id } : {}),
                    date,
                    description: description.trim(),
                    type,
                    amount: amountNum,
                    accountId,
                    destinationId,
                }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not save transaction.");
                setSaving(false);
                return;
            }
            onSaved();
        } catch {
            setError("Network error. Please try again.");
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!transaction) return;
        if (!confirm("Delete this transaction? This cannot be undone.")) return;

        setError("");
        setDeleting(true);
        try {
            const res = await fetch("/api/transactions", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: transaction.id }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not delete transaction.");
                setDeleting(false);
                return;
            }
            onSaved();
        } catch {
            setError("Network error. Please try again.");
            setDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">{isEditing ? "Edit Transaction" : "Add Transaction"}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                    {(["income", "expense", "transfer"] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => handleTypeChange(t)}
                            className={`rounded-xl py-3 text-sm font-bold capitalize transition-colors duration-150 select-none ${
                                type === t
                                    ? t === "income"
                                        ? "bg-brand text-white"
                                        : t === "expense"
                                          ? "bg-danger text-white"
                                          : "bg-ink text-white"
                                    : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Date</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Description</span>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. Groceries"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Amount (€)</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{type === "transfer" ? "From Account" : "Account"}</span>
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={INPUT_CLS}>
                        <option value="">Select an account</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{type === "transfer" ? "To Account" : "Category"}</span>
                    <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={INPUT_CLS}>
                        <option value="">{type === "transfer" ? "Select destination account" : "Select a category"}</option>
                        {destinationOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </select>
                </label>

                {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

                <button type="submit" disabled={saving || deleting} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                    {saving ? "Saving…" : isEditing ? "Save Changes" : "Save Transaction"}
                </button>

                {isEditing && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving || deleting}
                        className="mt-3 w-full rounded-2xl border-2 border-danger/25 bg-danger-soft py-4 text-lg font-bold text-danger transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-danger/40 hover:shadow-md active:translate-y-0 disabled:opacity-60 select-none"
                    >
                        {deleting ? "Deleting…" : "Delete Transaction"}
                    </button>
                )}
            </form>
        </div>
    );
}

// ---------- Transactions list ----------

function TransactionsView({
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

// ---------- Configuration ----------

type ConfigSection = "menu" | "accounts" | "categories" | "export" | "import" | "danger";

const CONFIG_SECTION_TITLES: Record<Exclude<ConfigSection, "menu">, string> = {
    accounts: "Accounts",
    categories: "Categories",
    export: "Export Data",
    import: "Import Data",
    danger: "Delete Data",
};

function MenuRow({
    label,
    onClick,
    danger = false,
    chevron = true,
    last = false,
}: {
    label: string;
    onClick: () => void;
    danger?: boolean;
    chevron?: boolean;
    last?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-150 select-none ${
                last ? "" : "border-b border-line"
            } ${danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-chip"}`}
        >
            <span className="flex-1 text-base font-semibold">{label}</span>
            {chevron && <IconChevronRight className="h-4 w-4 shrink-0 text-muted" />}
        </button>
    );
}

function AccountList({
    items,
    onRename,
    onSetInitialBalance,
    onDelete,
}: {
    items: Account[];
    onRename: (a: Account, name: string) => void;
    onSetInitialBalance: (a: Account, value: number) => void;
    onDelete: (a: Account) => void;
}) {
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState("");
    const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
    const [editingBalanceValue, setEditingBalanceValue] = useState("");

    function startEditingName(a: Account) {
        setEditingNameId(a.id);
        setEditingNameValue(a.name);
    }

    function commitEditingName(a: Account) {
        const trimmed = editingNameValue.trim();
        if (trimmed && trimmed !== a.name) {
            onRename(a, trimmed);
        }
        setEditingNameId(null);
    }

    function startEditingBalance(a: Account) {
        setEditingBalanceId(a.id);
        setEditingBalanceValue(String(a.initialBalance));
    }

    function commitEditingBalance(a: Account) {
        const parsed = Number(editingBalanceValue.trim().replace(",", "."));
        if (Number.isFinite(parsed) && parsed !== a.initialBalance) {
            onSetInitialBalance(a, parsed);
        }
        setEditingBalanceId(null);
    }

    if (items.length === 0) {
        return <p className="text-sm text-muted">No accounts yet.</p>;
    }

    return (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {items.map((a) => (
                <div key={a.id} className="flex items-center gap-1 bg-paper px-3 py-2.5">
                    {editingNameId === a.id ? (
                        <input
                            autoFocus
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => commitEditingName(a)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitEditingName(a);
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingNameId(null);
                                }
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                    ) : (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{a.name}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => startEditingName(a)}
                        aria-label={`Rename ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                    >
                        <IconPencil className="h-4 w-4" />
                    </button>
                    {editingBalanceId === a.id ? (
                        <input
                            autoFocus
                            inputMode="decimal"
                            value={editingBalanceValue}
                            onChange={(e) => setEditingBalanceValue(e.target.value)}
                            onBlur={() => commitEditingBalance(a)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitEditingBalance(a);
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingBalanceId(null);
                                }
                            }}
                            className="w-24 shrink-0 rounded-lg border border-line bg-paper px-2 py-1 text-right text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                    ) : (
                        <span className="shrink-0 text-sm text-muted">Starts at {eur.format(a.initialBalance)}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => startEditingBalance(a)}
                        aria-label={`Edit initial balance for ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                    >
                        <IconPencil className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(a)}
                        aria-label={`Delete ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                    >
                        <IconClose className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function SortableCategoryRow({
    category,
    isColorPickerOpen,
    onToggleColorPicker,
    onSetDefault,
    onSetColor,
    onDelete,
    isEditing,
    editingValue,
    onStartEditing,
    onEditingValueChange,
    onCommitEditing,
    onCancelEditing,
}: {
    category: Category;
    isColorPickerOpen: boolean;
    onToggleColorPicker: () => void;
    onSetDefault: () => void;
    onSetColor: (color: string) => void;
    onDelete: () => void;
    isEditing: boolean;
    editingValue: string;
    onStartEditing: () => void;
    onEditingValueChange: (value: string) => void;
    onCommitEditing: () => void;
    onCancelEditing: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="relative bg-paper">
            <div className={`flex items-center gap-1 px-2 py-2 ${isDragging ? "shadow-md ring-1 ring-brand/30" : ""}`}>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={`Reorder ${category.name}`}
                    className="shrink-0 cursor-grab touch-none rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink active:cursor-grabbing"
                >
                    <IconGrip className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onSetDefault}
                    role="radio"
                    aria-checked={category.isDefault}
                    title={category.isDefault ? "Default category" : "Set as default"}
                    aria-label={category.isDefault ? `${category.name} is the default` : `Set ${category.name} as default`}
                    className={`shrink-0 rounded-full p-1.5 transition-colors duration-150 ${
                        category.isDefault ? "text-brand" : "text-muted hover:text-ink"
                    }`}
                >
                    <IconRadioDot className="h-4 w-4" checked={category.isDefault} />
                </button>
                <button
                    type="button"
                    onClick={onToggleColorPicker}
                    aria-label={`Change color for ${category.name}`}
                    className="h-5 w-5 shrink-0 rounded-full border border-line/50"
                    style={{ backgroundColor: category.color ?? "#e5e0d8" }}
                />
                {isEditing ? (
                    <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => onEditingValueChange(e.target.value)}
                        onBlur={onCommitEditing}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onCommitEditing();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                onCancelEditing();
                            }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                ) : (
                    <>
                        <span className="min-w-0 flex-1 truncate pl-2 text-sm font-medium text-ink">{category.name}</span>
                        <button
                            type="button"
                            onClick={onStartEditing}
                            aria-label={`Rename ${category.name}`}
                            className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                        >
                            <IconPencil className="h-4 w-4" />
                        </button>
                    </>
                )}
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Delete ${category.name}`}
                    className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                >
                    <IconClose className="h-4 w-4" />
                </button>
            </div>
            {isColorPickerOpen && (
                <div className="flex flex-wrap gap-2 border-t border-line bg-chip px-3 py-3">
                    {CATEGORY_COLOR_PALETTE.map((swatch) => (
                        <button
                            key={swatch}
                            type="button"
                            onClick={() => onSetColor(swatch)}
                            aria-label={`Set ${category.name} color to ${swatch}`}
                            className={`h-6 w-6 shrink-0 rounded-full border-2 transition-transform duration-150 hover:scale-110 ${
                                category.color === swatch ? "border-ink" : "border-white/60"
                            }`}
                            style={{ backgroundColor: swatch }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CategoryList({
    title,
    type,
    items,
    onReorder,
    onSetDefault,
    onSetColor,
    onRename,
    onDelete,
}: {
    title: string;
    type: "income" | "expense";
    items: Category[];
    onReorder: (type: "income" | "expense", orderedIds: string[]) => void;
    onSetDefault: (c: Category) => void;
    onSetColor: (c: Category, color: string) => void;
    onRename: (c: Category, name: string) => void;
    onDelete: (c: Category) => void;
}) {
    const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [localItems, setLocalItems] = useState(items);

    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function startEditing(c: Category) {
        setEditingId(c.id);
        setEditingValue(c.name);
    }

    function commitEditing(c: Category) {
        const trimmed = editingValue.trim();
        if (trimmed && trimmed !== c.name) {
            onRename(c, trimmed);
        }
        setEditingId(null);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = localItems.findIndex((x) => x.id === active.id);
        const newIndex = localItems.findIndex((x) => x.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(localItems, oldIndex, newIndex);
        setLocalItems(reordered);
        onReorder(type, reordered.map((x) => x.id));
    }

    return (
        <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
            {localItems.length === 0 ? (
                <p className="text-sm text-muted">No categories yet.</p>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localItems.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                            {localItems.map((c) => (
                                <SortableCategoryRow
                                    key={c.id}
                                    category={c}
                                    isColorPickerOpen={colorPickerFor === c.id}
                                    onToggleColorPicker={() => setColorPickerFor(colorPickerFor === c.id ? null : c.id)}
                                    onSetDefault={() => onSetDefault(c)}
                                    onSetColor={(color) => {
                                        onSetColor(c, color);
                                        setColorPickerFor(null);
                                    }}
                                    onDelete={() => onDelete(c)}
                                    isEditing={editingId === c.id}
                                    editingValue={editingValue}
                                    onStartEditing={() => startEditing(c)}
                                    onEditingValueChange={setEditingValue}
                                    onCommitEditing={() => commitEditing(c)}
                                    onCancelEditing={() => setEditingId(null)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

function ConfigView({
    accounts,
    categories,
    onRefresh,
    onLogout,
    onPasswordChanged,
    onImported,
    onAccountDeleted,
}: {
    accounts: Account[];
    categories: Category[];
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
        const initialBalance = trimmedBalance ? Number(trimmedBalance.replace(",", ".")) : 0;
        if (!Number.isFinite(initialBalance)) {
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

    async function handleSetInitialBalance(a: Account, value: number) {
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

    async function handleReorderCategories(type: "income" | "expense", orderedIds: string[]) {
        setError("");
        const res = await fetch("/api/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", type, orderedIds }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
            setError(data.error || "Could not reorder categories.");
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

// ---------- Change password ----------

function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not change password.");
                setSaving(false);
                return;
            }
            onChanged();
        } catch {
            setError("Network error. Please try again.");
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">Change Password</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <p className="mb-4 text-sm text-muted">
                    You&apos;ll need to log in again after changing your password.
                </p>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Current Password</span>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        minLength={1}
                        autoComplete="current-password"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">New Password</span>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={1}
                        autoComplete="new-password"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Confirm New Password</span>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={1}
                        autoComplete="new-password"
                        className={INPUT_CLS}
                    />
                </label>

                {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

                <button type="submit" disabled={saving} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                    {saving ? "Saving…" : "Change Password"}
                </button>
            </form>
        </div>
    );
}
