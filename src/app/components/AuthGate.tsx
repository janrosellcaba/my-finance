"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { INPUT_CLS, PRIMARY_BTN } from "../shared";

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
