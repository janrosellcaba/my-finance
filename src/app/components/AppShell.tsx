"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { type Account, type Category, type DashboardSummary, type Tab } from "../shared";
import { AddTransactionModal } from "./AddTransactionModal";
import { AnalyticsView } from "./AnalyticsView";
import { BottomNav } from "./BottomNav";
import { ConfigView } from "./ConfigView";
import { HomeView } from "./HomeView";
import { TodoView } from "./TodoView";
import { TransactionsView } from "./TransactionsView";
import { IconEye, IconEyeOff } from "./icons";

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
        <div className="fixed inset-0 flex flex-col bg-cream">
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
