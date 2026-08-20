"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { type Account, type Category, type DashboardSummary, type Tab, type Theme } from "../shared";
import { AddTransactionModal } from "./AddTransactionModal";
import { AnalyticsView } from "./AnalyticsView";
import { BottomNav } from "./BottomNav";
import { ConfigView } from "./ConfigView";
import { HomeView } from "./HomeView";
import { TodoView } from "./TodoView";
import { TransactionsView } from "./TransactionsView";
import { UndoToastProvider } from "./UndoToastProvider";
import { IconEye, IconEyeOff } from "./icons";
import { getFromCache, getOutbox, saveToCache, syncOutbox } from "@/lib/offlineStore";

export function AppShell({
    username,
    initialPrivacyMode,
    initialTheme,
}: {
    username: string;
    initialPrivacyMode: boolean;
    initialTheme: Theme;
}) {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("home");
    const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [privacyMode, setPrivacyMode] = useState(initialPrivacyMode);
    const [theme, setTheme] = useState<Theme>(initialTheme);
    const [isOnline, setIsOnline] = useState(true);
    const [outboxCount, setOutboxCount] = useState(0);
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        mainRef.current?.scrollTo(0, 0);
    }, [tab]);

    const loadDashboard = useCallback(async () => {
        try {
            const res = await fetch("/api/dashboard");
            if (res.status === 401) {
                router.refresh();
                return;
            }
            const data = (await res.json()) as { success: boolean; summary?: DashboardSummary };
            if (data.success && data.summary) {
                setDashboard(data.summary);
                await saveToCache("dashboard", data.summary);
            }
        } catch {
            const cached = await getFromCache<DashboardSummary>("dashboard");
            if (cached) setDashboard(cached);
        } finally {
            setLoadingDashboard(false);
        }
    }, [router]);

    const loadConfig = useCallback(async () => {
        try {
            const res = await fetch("/api/config");
            if (res.status === 401) {
                router.refresh();
                return;
            }
            const data = (await res.json()) as { success: boolean; accounts?: Account[]; categories?: Category[] };
            if (data.success) {
                setAccounts(data.accounts ?? []);
                setCategories(data.categories ?? []);
                await saveToCache("config", { accounts: data.accounts, categories: data.categories });
            }
        } catch {
            const cached = await getFromCache<{ accounts?: Account[]; categories?: Category[] }>("config");
            if (cached) {
                if (cached.accounts) setAccounts(cached.accounts);
                if (cached.categories) setCategories(cached.categories);
            }
        }
    }, [router]);

    useEffect(() => {
        if (typeof navigator !== "undefined") {
            setIsOnline(navigator.onLine);
        }

        async function checkOutbox() {
            const items = await getOutbox();
            setOutboxCount(items.length);
        }

        async function handleOnline() {
            setIsOnline(true);
            const { syncedCount } = await syncOutbox();
            await checkOutbox();
            if (syncedCount > 0) {
                await Promise.all([loadDashboard(), loadConfig()]);
            }
        }

        function handleOffline() {
            setIsOnline(false);
            checkOutbox();
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        checkOutbox();

        loadDashboard();
        loadConfig();

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
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

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable)
            ) {
                return;
            }

            if (e.metaKey || e.ctrlKey || e.altKey) return;

            if (e.key === "t" || e.key === "T" || e.key === "n" || e.key === "N") {
                e.preventDefault();
                setShowAddModal(true);
            } else if (e.key === "1") {
                setTab("home");
            } else if (e.key === "2") {
                setTab("transactions");
            } else if (e.key === "3") {
                setTab("todo");
            } else if (e.key === "4") {
                setTab("analytics");
            } else if (e.key === "5") {
                setTab("config");
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    async function handleTransactionSaved() {
        setShowAddModal(false);
        const items = await getOutbox();
        setOutboxCount(items.length);
        await loadDashboard();
    }

    async function handleSetTheme(next: Theme) {
        const previous = theme;
        setTheme(next);
        document.documentElement.dataset.theme = next;
        const res = await fetch("/api/theme", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme: next }),
        });
        if (!res.ok) {
            setTheme(previous);
            document.documentElement.dataset.theme = previous;
        }
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
        <UndoToastProvider>
            <div className="fixed inset-0 flex flex-col bg-cream h-[100dvh] max-h-[100dvh]">
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
                            className={`rounded-full p-2.5 transition-all duration-150 active:scale-90 ${
                                privacyMode
                                    ? "bg-brand/10 text-brand hover:bg-brand/15"
                                    : "text-muted hover:bg-chip hover:text-ink"
                            }`}
                        >
                            {privacyMode ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                        </button>
                    </div>
                </header>

                {!isOnline && (
                    <div className="shrink-0 bg-ink px-4 py-2 text-center text-xs font-semibold text-paper flex items-center justify-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>
                            Offline Mode{outboxCount > 0 ? ` — ${outboxCount} item(s) pending sync` : " — showing cached data"}
                        </span>
                    </div>
                )}

                <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                    <div className={`mx-auto pb-6 ${tab === "analytics" ? "max-w-md lg:max-w-6xl" : "max-w-md"}`}>
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
                        {tab === "todo" && <TodoView />}
                        {tab === "analytics" && <AnalyticsView privacyMode={privacyMode} />}
                        {tab === "config" && (
                            <ConfigView
                                accounts={accounts}
                                categories={categories}
                                privacyMode={privacyMode}
                                theme={theme}
                                onSetTheme={handleSetTheme}
                                onRefresh={async () => {
                                    await Promise.all([loadConfig(), loadDashboard()]);
                                }}
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
        </UndoToastProvider>
    );
}
