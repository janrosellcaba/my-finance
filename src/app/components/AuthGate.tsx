"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLanguage, useT } from "@/i18n/I18nProvider";
import { INPUT_CLS, PRIMARY_BTN, SUPPORT_EMAIL } from "../shared";
import { PasswordInput } from "./PasswordInput";

export function AuthGate() {
    const t = useT();
    const language = useLanguage();
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
        const payload =
            mode === "login" ? { username, password } : { username, password, secretCode, language };

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || t("common.somethingWrong"));
                setLoading(false);
                return;
            }
            router.refresh();
        } catch {
            setError(t("common.networkError"));
            setLoading(false);
        }
    }

    return (
        <div className="flex h-full items-center justify-center overflow-y-auto bg-cream px-5 py-10">
            <div className="w-full max-w-sm surface rounded-3xl p-8">
                <div className="mb-3 flex justify-center">
                    <Image src="/logo.png" alt="" width={52} height={52} priority className="theme-logo opacity-90" />
                </div>
                <h1 className="text-center text-3xl font-semibold tracking-tight text-ink">MyFinance</h1>
                <p className="mb-6 text-center text-sm text-muted">
                    {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-ink">{t("auth.username")}</span>
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
                        <span className="mb-1 block text-sm font-semibold text-ink">{t("auth.password")}</span>
                        <PasswordInput
                            value={password}
                            onChange={setPassword}
                            required
                            minLength={1}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                        />
                    </label>

                    {mode === "signup" && (
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-ink">{t("auth.safetyCode")}</span>
                            <input value={secretCode} onChange={(e) => setSecretCode(e.target.value)} required className={INPUT_CLS} />
                        </label>
                    )}

                    {error && <p className="text-sm font-medium text-danger">{error}</p>}

                    <button type="submit" disabled={loading} className={`${PRIMARY_BTN} w-full`}>
                        {loading ? t("common.pleaseWait") : mode === "login" ? t("auth.logIn") : t("auth.createAccountBtn")}
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
                    {mode === "login" ? t("auth.newHere") : t("auth.haveAccount")}
                </button>

                <p className="mt-4 text-center text-xs text-muted">
                    {t("auth.contactSupport")}{" "}
                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=MyFinance%20support`}
                        className="font-medium text-brand transition-colors duration-150 hover:text-brand-dark"
                    >
                        {SUPPORT_EMAIL}
                    </a>
                </p>
            </div>
        </div>
    );
}
