"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useT } from "@/i18n/I18nProvider";
import { type Todo, INPUT_CLS, PRIMARY_BTN } from "../shared";
import { IconClose } from "./icons";
import { enqueueOutbox } from "@/lib/offlineStore";

export function AddTodoModal({
    todo,
    parentId = null,
    onClose,
    onSaved,
}: {
    todo?: Todo;
    parentId?: string | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const t = useT();
    const isEditing = !!todo;
    const isSubtask = !isEditing && !!parentId;
    const [text, setText] = useState(todo?.text ?? "");
    const [dueDate, setDueDate] = useState(todo?.dueDate ?? "");
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
            setError(t("todos.enterTask"));
            return;
        }

        const payload = {
            id: todo?.id ?? crypto.randomUUID(),
            text: text.trim(),
            dueDate: dueDate || null,
            ...(isEditing ? {} : { parentId: parentId || null }),
        };

        if (typeof navigator !== "undefined" && !navigator.onLine && !isEditing) {
            await enqueueOutbox({ id: payload.id, type: "todo", payload });
            onSaved();
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/todos", {
                method: isEditing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || t("todos.saveFailed"));
                setSaving(false);
                return;
            }
            onSaved();
        } catch {
            if (!isEditing) {
                await enqueueOutbox({ id: payload.id, type: "todo", payload });
                setSaving(false);
                onSaved();
                return;
            }
            setError(t("common.networkError"));
            setSaving(false);
        }
    }

    const title = isEditing ? t("todos.editTask") : isSubtask ? t("todos.addSubtask") : t("todos.addTask");
    const submitLabel = saving
        ? t("common.saving")
        : isEditing
          ? t("tx.saveChanges")
          : isSubtask
            ? t("todos.addSubtask")
            : t("todos.addTask");

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="w-full max-w-md surface rounded-t-3xl p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-muted/25 sm:hidden" />
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">
                        {isSubtask ? t("todos.subtask") : t("todos.task")}
                    </span>
                    <input
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={isSubtask ? t("todos.subtaskPlaceholder") : t("todos.taskPlaceholder")}
                        className={INPUT_CLS}
                    />
                </label>

                <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between">
                        <label htmlFor="todo-due-date" className="text-sm font-semibold text-ink">
                            {t("todos.dueDate")}
                        </label>
                        {dueDate ? (
                            <button
                                type="button"
                                onClick={() => setDueDate("")}
                                className="text-xs font-semibold text-muted transition-colors hover:text-ink"
                            >
                                {t("common.clear")}
                            </button>
                        ) : (
                            <span className="text-xs text-muted">{t("common.optional")}</span>
                        )}
                    </div>
                    <input
                        id="todo-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className={INPUT_CLS}
                    />
                </div>

                {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

                <button type="submit" disabled={saving} className={`${PRIMARY_BTN} w-full`}>
                    {submitLabel}
                </button>
            </form>
        </div>
    );
}
