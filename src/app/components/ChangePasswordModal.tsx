"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useT } from "@/i18n/I18nProvider";
import { PRIMARY_BTN } from "../shared";
import { IconClose } from "./icons";
import { PasswordInput } from "./PasswordInput";

export function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
    const t = useT();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError(t("password.mismatch"));
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
                setError(data.error || t("password.failed"));
                setSaving(false);
                return;
            }
            onChanged();
        } catch {
            setError(t("common.networkError"));
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                role="dialog"
                aria-modal="true"
                aria-label={t("password.title")}
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto surface rounded-t-3xl p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-muted/25 sm:hidden" />
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">{t("password.title")}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <p className="mb-4 text-sm text-muted">
                    {t("password.hint")}
                </p>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{t("password.current")}</span>
                    <PasswordInput
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        required
                        minLength={1}
                        autoComplete="current-password"
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{t("password.new")}</span>
                    <PasswordInput
                        value={newPassword}
                        onChange={setNewPassword}
                        required
                        minLength={1}
                        autoComplete="new-password"
                    />
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{t("password.confirm")}</span>
                    <PasswordInput
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        required
                        minLength={1}
                        autoComplete="new-password"
                    />
                </label>

                {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

                <button type="submit" disabled={saving} className={`${PRIMARY_BTN} w-full`}>
                    {saving ? t("common.saving") : t("password.submit")}
                </button>
            </form>
        </div>
    );
}
