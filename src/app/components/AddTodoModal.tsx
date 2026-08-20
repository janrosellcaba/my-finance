"use client";

import { useEffect, useState, type FormEvent } from "react";
import { INPUT_CLS, PRIMARY_BTN } from "../shared";
import { IconClose } from "./icons";
import { enqueueOutbox } from "@/lib/offlineStore";

export function AddTodoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [text, setText] = useState("");
    const [dueDate, setDueDate] = useState("");
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

        if (!text.trim()) {
            setError("Please enter a task.");
            return;
        }

        const id = crypto.randomUUID();
        const payload = { id, text: text.trim(), dueDate: dueDate || null };

        if (typeof navigator !== "undefined" && !navigator.onLine) {
            await enqueueOutbox({ id, type: "todo", payload });
            onSaved();
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/todos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not save task.");
                setSaving(false);
                return;
            }
            onSaved();
        } catch {
            await enqueueOutbox({ id, type: "todo", payload });
            setSaving(false);
            onSaved();
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                role="dialog"
                aria-modal="true"
                aria-label="Add Task"
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">Add Task</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Task</span>
                    <input
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="e.g. Pay the rent"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Date (optional)</span>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT_CLS} />
                </label>

                {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

                <button type="submit" disabled={saving} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                    {saving ? "Saving…" : "Add Task"}
                </button>
            </form>
        </div>
    );
}
