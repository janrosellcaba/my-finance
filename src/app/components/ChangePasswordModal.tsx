"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PRIMARY_BTN } from "../shared";
import { IconClose } from "./icons";
import { PasswordInput } from "./PasswordInput";

export function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
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
                role="dialog"
                aria-modal="true"
                aria-label="Change Password"
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-muted/25 sm:hidden" />
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
                    <PasswordInput
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        required
                        minLength={1}
                        autoComplete="current-password"
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">New Password</span>
                    <PasswordInput
                        value={newPassword}
                        onChange={setNewPassword}
                        required
                        minLength={1}
                        autoComplete="new-password"
                    />
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Confirm New Password</span>
                    <PasswordInput
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        required
                        minLength={1}
                        autoComplete="new-password"
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
