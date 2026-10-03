"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_OPTIONS, type TFunction } from "@/i18n";
import { useT } from "@/i18n/I18nProvider";
import type { AdminUserSummary } from "@/lib/admin";
import {
    DANGER_BTN,
    type Account,
    type Category,
    type CurrencyCode,
    type Transaction,
    formatCurrency,
    formatDate,
    formatDateTime,
    parseDateTime,
} from "../shared";
import { TransactionCard } from "./TransactionCard";
import { AccountIcon, IconArrowLeft, IconChevronRight } from "./icons";

type AdminUserDetail = {
    accounts: Account[];
    categories: Category[];
    recentTransactions: Transaction[];
    accountBalances: { id: string; name: string; icon: string | null; balance: number }[];
};

function isCurrency(value: string): value is CurrencyCode {
    return value === "EUR" || value === "USD" || value === "GBP";
}

function userCurrency(user: AdminUserSummary): CurrencyCode {
    return isCurrency(user.currency) ? user.currency : "EUR";
}

function languageLabel(code: string | null): string | null {
    if (!code) return null;
    return LANGUAGE_OPTIONS.find((option) => option.key === code)?.nativeName ?? code;
}

function lastSeenLabel(lastSeenAt: string | null, t: TFunction): string {
    if (!lastSeenAt) return t("admin.neverSeen");
    const date = parseDateTime(lastSeenAt);
    if (!date) return t("admin.neverSeen");
    const diff = Date.now() - date.getTime();
    let when: string;
    if (diff < 45_000) when = t("admin.justNow");
    else if (diff < 60 * 60_000) when = t("admin.minutesAgo", { count: Math.max(1, Math.round(diff / 60_000)) });
    else if (diff < 24 * 60 * 60_000) when = t("admin.hoursAgo", { count: Math.max(1, Math.round(diff / 3_600_000)) });
    else when = formatDateTime(lastSeenAt);
    return t("admin.lastSeen", { when });
}

export function AdminView({ currentUsername }: { currentUsername: string }) {
    const t = useT();
    const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
    const [error, setError] = useState(false);
    const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
    const [detail, setDetail] = useState<AdminUserDetail | null>(null);
    const [detailError, setDetailError] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    function loadUsers() {
        return fetch("/api/admin/users")
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load users");
                const data = (await res.json()) as { success?: boolean; users?: AdminUserSummary[] };
                if (!data.success || !data.users) throw new Error("Failed to load users");
                setUsers(data.users);
            });
    }

    useEffect(() => {
        let cancelled = false;
        loadUsers().catch(() => {
            if (!cancelled) setError(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selectedUsername) {
            setDetail(null);
            setDetailError(false);
            setDeleteError("");
            return;
        }
        let cancelled = false;
        setDetail(null);
        setDetailError(false);
        setDeleteError("");
        fetch(`/api/admin/users/${encodeURIComponent(selectedUsername)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load user");
                const data = (await res.json()) as { success?: boolean } & Partial<AdminUserDetail>;
                if (!data.success || !data.accounts || !data.categories || !data.recentTransactions || !data.accountBalances) {
                    throw new Error("Failed to load user");
                }
                if (!cancelled) {
                    setDetail({
                        accounts: data.accounts,
                        categories: data.categories,
                        recentTransactions: data.recentTransactions,
                        accountBalances: data.accountBalances,
                    });
                }
            })
            .catch(() => {
                if (!cancelled) setDetailError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedUsername]);

    if (error) {
        return <p className="text-sm font-medium text-danger">{t("admin.loadError")}</p>;
    }

    if (!users) {
        return (
            <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 rounded-full bg-chip" />
                <div className="overflow-hidden surface rounded-2xl">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`space-y-2 px-5 py-4 ${i === 2 ? "" : "border-b border-line"}`}>
                            <div className="h-4 w-28 rounded-full bg-chip" />
                            <div className="h-5 w-24 rounded-full bg-chip" />
                            <div className="h-3 w-40 rounded-full bg-chip" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const selected = selectedUsername ? users.find((user) => user.username === selectedUsername) ?? null : null;

    if (selectedUsername && selected) {
        const currency = userCurrency(selected);
        const language = languageLabel(selected.language);
        const isSelf = selected.username === currentUsername;
        const usernameToDelete = selected.username;

        async function handleDelete() {
            if (!confirm(t("admin.deleteUserConfirm", { name: usernameToDelete }))) return;
            setDeleting(true);
            setDeleteError("");
            try {
                const res = await fetch(`/api/admin/users/${encodeURIComponent(usernameToDelete)}`, {
                    method: "DELETE",
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) {
                    setDeleteError(data.error || t("admin.deleteUserFailed"));
                    return;
                }
                setSelectedUsername(null);
                await loadUsers().catch(() => setError(true));
            } catch {
                setDeleteError(t("common.networkError"));
            } finally {
                setDeleting(false);
            }
        }

        return (
            <section className="space-y-5">
                <button
                    type="button"
                    onClick={() => setSelectedUsername(null)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"
                >
                    <IconArrowLeft className="h-4 w-4" />
                    {t("admin.allUsers")}
                </button>

                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-ink">{selected.username}</h2>
                        {isSelf && (
                            <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-muted">
                                {t("admin.you")}
                            </span>
                        )}
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${selected.balance >= 0 ? "text-brand" : "text-danger"}`}>
                        {formatCurrency(selected.balance, false, currency)}
                    </p>
                    <p className="text-sm text-muted">{lastSeenLabel(selected.lastSeenAt, t)}</p>
                    <p className="text-sm text-muted">
                        {t("admin.joined", { date: formatDate(selected.createdAt) })}
                        {" · "}
                        {t("admin.transactions", { count: selected.transactionCount })}
                        {language ? ` · ${language}` : ""}
                        {` · ${t("admin.sessions", { count: selected.activeSessionCount })}`}
                    </p>
                </div>

                {detailError && <p className="text-sm font-medium text-danger">{t("admin.loadDetailError")}</p>}

                {!detail && !detailError && (
                    <div className="animate-pulse space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-20 surface rounded-2xl bg-chip/60" />
                            <div className="h-20 surface rounded-2xl bg-chip/60" />
                        </div>
                        <div className="h-32 surface rounded-2xl bg-chip/60" />
                    </div>
                )}

                {detail && (
                    <>
                        <div>
                            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                                {t("admin.bankAccounts")}
                            </h3>
                            {detail.accountBalances.length === 0 ? (
                                <p className="text-sm text-muted">{t("admin.noAccounts")}</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {detail.accountBalances.map((acc) => (
                                        <div key={acc.id} className="surface rounded-2xl p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-chip text-muted">
                                                    <AccountIcon iconKey={acc.icon ?? "wallet"} className="h-3.5 w-3.5" />
                                                </span>
                                                <p className="truncate text-xs font-semibold text-muted">{acc.name}</p>
                                            </div>
                                            <p
                                                className={`mt-2 text-lg font-bold tracking-tight tabular-nums ${
                                                    acc.balance >= 0 ? "text-brand" : "text-danger"
                                                }`}
                                            >
                                                {formatCurrency(acc.balance, false, currency)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                                {t("admin.recentTransactions")}
                            </h3>
                            {detail.recentTransactions.length === 0 ? (
                                <p className="text-sm text-muted">{t("admin.noActivity")}</p>
                            ) : (
                                <div className="overflow-hidden surface rounded-2xl divide-y divide-line">
                                    {detail.recentTransactions.map((tx) => (
                                        <TransactionCard
                                            key={tx.id}
                                            tx={tx}
                                            accounts={detail.accounts}
                                            categories={detail.categories}
                                            privacyMode={false}
                                            compact
                                            currency={currency}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {deleteError && <p className="text-sm font-medium text-danger">{deleteError}</p>}

                {isSelf ? (
                    <p className="text-xs text-muted">{t("admin.deleteOwnUser")}</p>
                ) : (
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={() => void handleDelete()}
                        className={`${DANGER_BTN} w-full`}
                    >
                        {t("admin.deleteUser")}
                    </button>
                )}
            </section>
        );
    }

    return (
        <section className="space-y-3">
            <p className="text-sm text-muted">{t("admin.userCount", { count: users.length })}</p>
            <div className="overflow-hidden surface rounded-2xl">
                {users.map((user, index) => {
                    const currency = userCurrency(user);
                    return (
                        <button
                            key={user.username}
                            type="button"
                            onClick={() => setSelectedUsername(user.username)}
                            className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-chip ${
                                index === users.length - 1 ? "" : "border-b border-line"
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-base font-semibold text-ink">{user.username}</p>
                                    {user.username === currentUsername && (
                                        <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-muted">
                                            {t("admin.you")}
                                        </span>
                                    )}
                                </div>
                                <p
                                    className={`mt-0.5 text-base font-bold tabular-nums ${
                                        user.balance >= 0 ? "text-brand" : "text-danger"
                                    }`}
                                >
                                    {formatCurrency(user.balance, false, currency)}
                                </p>
                                <p className="mt-1 truncate text-sm text-muted">{lastSeenLabel(user.lastSeenAt, t)}</p>
                                <p className="mt-0.5 truncate text-sm text-muted">
                                    {t("admin.transactions", { count: user.transactionCount })}
                                    {" · "}
                                    {t("admin.accounts", { count: user.accountCount })}
                                </p>
                            </div>
                            <IconChevronRight className="h-4 w-4 shrink-0 text-muted" />
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
