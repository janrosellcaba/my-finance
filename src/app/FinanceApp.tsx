"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Account = { id: string; name: string };
type Category = { id: string; name: string; type: "income" | "expense" };
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
type Tab = "home" | "transactions" | "config";

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

const INPUT_CLS =
    "w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

const PRIMARY_BTN =
    "rounded-2xl py-4 text-lg font-bold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-60 select-none";

const INK_BTN =
    "rounded-xl bg-ink px-5 py-3 font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-ink/90 hover:shadow-md active:translate-y-0 select-none";

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

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

export function AppShell({ username }: { username: string }) {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("home");
    const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);

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

    async function handleTransactionSaved() {
        setShowAddModal(false);
        await loadDashboard();
    }

    return (
        <div className="min-h-screen bg-cream pb-28">
            <header className="sticky top-0 z-30 border-b border-line bg-paper/90 px-5 py-4 backdrop-blur">
                <div className="flex items-center gap-2">
                    <Image src="/logo.png" alt="" width={20} height={20} className="opacity-80" />
                    <p className="text-lg font-extrabold text-ink">Hi, {username}</p>
                </div>
            </header>

            <main className="mx-auto max-w-md">
                {tab === "home" && (
                    <HomeView
                        dashboard={dashboard}
                        loading={loadingDashboard}
                        accounts={accounts}
                        categories={categories}
                        onAddClick={() => setShowAddModal(true)}
                    />
                )}
                {tab === "transactions" && <TransactionsView accounts={accounts} categories={categories} />}
                {tab === "config" && (
                    <ConfigView
                        accounts={accounts}
                        categories={categories}
                        onRefresh={loadConfig}
                        onLogout={handleLogout}
                        onPasswordChanged={handlePasswordChanged}
                    />
                )}
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
        { key: "config", label: "Settings", Icon: IconSettings },
    ];

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
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
    onAddClick,
}: {
    dashboard: DashboardSummary | null;
    loading: boolean;
    accounts: Account[];
    categories: Category[];
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
                    {eur.format(dashboard.totalNetWorth)}
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
                                {eur.format(acc.balance)}
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
                        <TransactionCard key={tx.id} tx={tx} accounts={accounts} categories={categories} />
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
}: {
    tx: Transaction;
    accounts: Account[];
    categories: Category[];
}) {
    const sign = tx.type === "expense" ? "-" : tx.type === "income" ? "+" : "";
    const color = tx.type === "expense" ? "text-danger" : tx.type === "income" ? "text-brand" : "text-ink";
    const fromName = resolveName(tx.accountId, accounts, categories);
    const toName = resolveName(tx.destinationId, accounts, categories);
    const subtitle = tx.type === "transfer" ? `${fromName} → ${toName}` : `${toName} · ${fromName}`;

    return (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-paper p-4 shadow-sm">
            <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{tx.description}</p>
                <p className="truncate text-xs text-muted">
                    {subtitle} · {formatDate(tx.date)}
                </p>
            </div>
            <p className={`ml-3 shrink-0 text-lg font-bold ${color}`}>
                {sign}
                {eur.format(Math.abs(tx.amount))}
            </p>
        </div>
    );
}

// ---------- Add transaction modal ----------

function AddTransactionModal({
    accounts,
    categories,
    onClose,
    onSaved,
}: {
    accounts: Account[];
    categories: Category[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState("");
    const [type, setType] = useState<TransactionType>("expense");
    const [accountId, setAccountId] = useState("");
    const [destinationId, setDestinationId] = useState("");
    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const destinationOptions: { id: string; name: string }[] =
        type === "transfer" ? accounts.filter((a) => a.id !== accountId) : categories.filter((c) => c.type === type);

    function handleTypeChange(next: TransactionType) {
        setType(next);
        setDestinationId("");
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        const amountNum = parseFloat(amount);

        if (!date || !description.trim()) {
            setError("Please fill in the date and description.");
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
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
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

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">Add Transaction</h2>
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

                <button type="submit" disabled={saving} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                    {saving ? "Saving…" : "Save Transaction"}
                </button>
            </form>
        </div>
    );
}

// ---------- Transactions list ----------

function TransactionsView({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);

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
            </form>

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

            {loading ? (
                <p className="pt-10 text-center text-muted">Loading…</p>
            ) : transactions.length === 0 ? (
                <p className="pt-10 text-center text-muted">No transactions found.</p>
            ) : (
                <div className="space-y-2">
                    {transactions.map((tx) => (
                        <TransactionCard key={tx.id} tx={tx} accounts={accounts} categories={categories} />
                    ))}
                </div>
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

function ConfigView({
    accounts,
    categories,
    onRefresh,
    onLogout,
    onPasswordChanged,
}: {
    accounts: Account[];
    categories: Category[];
    onRefresh: () => void;
    onLogout: () => void;
    onPasswordChanged: () => void;
}) {
    const [accountName, setAccountName] = useState("");
    const [categoryName, setCategoryName] = useState("");
    const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");
    const [savingAccount, setSavingAccount] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);
    const [error, setError] = useState("");
    const [showChangePassword, setShowChangePassword] = useState(false);

    async function handleAddAccount(e: FormEvent) {
        e.preventDefault();
        if (!accountName.trim()) return;
        setSavingAccount(true);
        setError("");
        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: "account", name: accountName.trim() }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not add account.");
                return;
            }
            setAccountName("");
            onRefresh();
        } finally {
            setSavingAccount(false);
        }
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

    return (
        <div className="space-y-6 px-5 pt-6">
            <h1 className="text-2xl font-extrabold text-ink">Configuration</h1>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Accounts</h2>
                <div className="mb-4 flex flex-wrap gap-2">
                    {accounts.map((a) => (
                        <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-chip py-1.5 pl-3 pr-1.5 text-sm font-medium text-ink"
                        >
                            {a.name}
                            <button
                                type="button"
                                onClick={() => handleDeleteAccount(a)}
                                aria-label={`Delete ${a.name}`}
                                className="rounded-full p-0.5 text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                            >
                                <IconClose className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    ))}
                </div>
                <form onSubmit={handleAddAccount} className="flex gap-2">
                    <input
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="New account name"
                        className={`flex-1 ${INPUT_CLS}`}
                    />
                    <button type="submit" disabled={savingAccount} className={`${PRIMARY_BTN} bg-brand px-5 py-3 text-base hover:bg-brand-dark`}>
                        Add
                    </button>
                </form>
            </section>

            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Categories</h2>
                <div className="mb-4 flex flex-wrap gap-2">
                    {categories.map((c) => (
                        <span
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-sm font-medium ${
                                c.type === "income" ? "bg-brand-soft text-brand-dark" : "bg-danger-soft text-danger-dark"
                            }`}
                        >
                            {c.name}
                            <button
                                type="button"
                                onClick={() => handleDeleteCategory(c)}
                                aria-label={`Delete ${c.name}`}
                                className="rounded-full p-0.5 opacity-70 transition-opacity duration-150 hover:opacity-100"
                            >
                                <IconClose className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    ))}
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

            <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className={`${INK_BTN} w-full text-center`}
            >
                Change Password
            </button>

            <button
                type="button"
                onClick={onLogout}
                className="w-full rounded-2xl border-2 border-danger/25 bg-danger-soft py-4 text-lg font-bold text-danger transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-danger/40 hover:shadow-md active:translate-y-0 select-none"
            >
                Log Out
            </button>

            {showChangePassword && (
                <ChangePasswordModal
                    onClose={() => setShowChangePassword(false)}
                    onChanged={onPasswordChanged}
                />
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
