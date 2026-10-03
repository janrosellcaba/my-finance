"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useT } from "@/i18n/I18nProvider";

const UNDO_WINDOW_MS = 5000;
const LEAVE_MS = 180;

type PendingToast = {
    id: string;
    message: string;
    kind: "undo" | "notice";
    leaving?: boolean;
    onUndo?: () => void;
    onCommit?: () => void;
};

type RequestDeleteArgs = {
    message: string;
    onUndo: () => void;
    onCommit: () => void;
};

type UndoToastContextValue = {
    requestDelete: (args: RequestDeleteArgs) => void;
    notify: (message: string) => void;
};

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
    const t = useT();
    const [toasts, setToasts] = useState<PendingToast[]>([]);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const settle = useCallback((id: string, commit: boolean) => {
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
        setToasts((prev) => {
            const toast = prev.find((item) => item.id === id);
            if (toast?.kind === "undo") {
                if (commit) toast.onCommit?.();
                else toast.onUndo?.();
            }
            return prev.filter((item) => item.id !== id);
        });
    }, []);

    const beginLeave = useCallback(
        (id: string, commit: boolean) => {
            let shouldAnimate = false;
            setToasts((prev) => {
                const toast = prev.find((item) => item.id === id);
                if (!toast || toast.leaving) return prev;
                shouldAnimate = true;
                return prev.map((item) => (item.id === id ? { ...item, leaving: true } : item));
            });
            if (!shouldAnimate) return;
            const timer = timers.current.get(id);
            if (timer) {
                clearTimeout(timer);
                timers.current.delete(id);
            }
            timers.current.set(
                id,
                setTimeout(() => settle(id, commit), LEAVE_MS),
            );
        },
        [settle],
    );

    const requestDelete = useCallback(
        ({ message, onUndo, onCommit }: RequestDeleteArgs) => {
            const id = crypto.randomUUID();
            setToasts((prev) => [...prev, { id, message, kind: "undo", onUndo, onCommit }]);
            timers.current.set(
                id,
                setTimeout(() => beginLeave(id, true), UNDO_WINDOW_MS),
            );
        },
        [beginLeave],
    );

    const notify = useCallback(
        (message: string) => {
            const id = crypto.randomUUID();
            setToasts((prev) => {
                for (const toast of prev) {
                    if (toast.kind !== "notice") continue;
                    const timer = timers.current.get(toast.id);
                    if (timer) {
                        clearTimeout(timer);
                        timers.current.delete(toast.id);
                    }
                }
                return [...prev.filter((toast) => toast.kind !== "notice"), { id, message, kind: "notice" }];
            });
            timers.current.set(
                id,
                setTimeout(() => beginLeave(id, true), 3500),
            );
        },
        [beginLeave],
    );

    return (
        <UndoToastContext.Provider value={{ requestDelete, notify }}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl surface px-4 py-3 text-sm text-ink ${
                            toast.leaving ? "toast-leave" : "toast-enter"
                        }`}
                    >
                        <span className="min-w-0 font-medium">{toast.message}</span>
                        {toast.kind === "undo" && (
                            <button
                                type="button"
                                onClick={() => beginLeave(toast.id, false)}
                                className="shrink-0 rounded-lg bg-chip px-2.5 py-1 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover"
                            >
                                {t("common.undo")}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </UndoToastContext.Provider>
    );
}

export function useUndoToast() {
    const ctx = useContext(UndoToastContext);
    if (!ctx) throw new Error("useUndoToast must be used within UndoToastProvider");
    return ctx;
}
