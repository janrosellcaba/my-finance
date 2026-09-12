"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_OPTIONS } from "@/i18n";
import { useT } from "@/i18n/I18nProvider";
import { formatDate } from "../shared";
import type { AdminUserSummary } from "@/lib/admin";

function languageLabel(code: string | null): string | null {
    if (!code) return null;
    return LANGUAGE_OPTIONS.find((option) => option.key === code)?.nativeName ?? code;
}

export function AdminView({ currentUsername }: { currentUsername: string }) {
    const t = useT();
    const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/admin/users")
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load users");
                const data = (await res.json()) as { success?: boolean; users?: AdminUserSummary[] };
                if (!data.success || !data.users) throw new Error("Failed to load users");
                if (!cancelled) setUsers(data.users);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        return <p className="text-sm font-medium text-danger">{t("admin.loadError")}</p>;
    }

    if (!users) {
        return (
            <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 rounded-full bg-chip" />
                <div className="space-y-0 overflow-hidden surface rounded-2xl">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`space-y-2 px-5 py-4 ${i === 2 ? "" : "border-b border-line"}`}>
                            <div className="h-4 w-28 rounded-full bg-chip" />
                            <div className="h-3 w-48 rounded-full bg-chip" />
                            <div className="h-3 w-40 rounded-full bg-chip" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <section className="space-y-3">
            <p className="text-sm text-muted">{t("admin.userCount", { count: users.length })}</p>
            <div className="overflow-hidden surface rounded-2xl">
                {users.map((user, index) => {
                    const language = languageLabel(user.language);
                    return (
                        <div
                            key={user.username}
                            className={`px-5 py-4 ${index === users.length - 1 ? "" : "border-b border-line"}`}
                        >
                            <div className="flex items-center gap-2">
                                <p className="text-base font-semibold text-ink">{user.username}</p>
                                {user.username === currentUsername && (
                                    <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-muted">
                                        {t("admin.you")}
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-muted">
                                {t("admin.joined", { date: formatDate(user.createdAt) })}
                                {" · "}
                                {t("admin.transactions", { count: user.transactionCount })}
                                {" · "}
                                {t("admin.accounts", { count: user.accountCount })}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                                {user.lastActivityAt
                                    ? t("admin.lastActivity", { date: formatDate(user.lastActivityAt) })
                                    : t("admin.noActivity")}
                                {language ? ` · ${language}` : ""}
                                {` · ${user.currency}`}
                                {` · ${t("admin.sessions", { count: user.activeSessionCount })}`}
                            </p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
