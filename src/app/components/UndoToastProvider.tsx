"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const UNDO_WINDOW_MS = 5000;

type PendingToast = {
    id: string;
    message: string;
    onUndo: () => void;
    onCommit: () => void;
};

type RequestDeleteArgs = {
    message: string;
    onUndo: () => void;
    onCommit: () => void;
};

type UndoToastContextValue = {
    requestDelete: (args: RequestDeleteArgs) => void;
};

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<PendingToast[]>([]);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const settle = useCallback((id: string, commit: boolean) => {
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
        setToasts((prev) => {
            const toast = prev.find((t) => t.id === id);
            if (toast) {
                if (commit) toast.onCommit();
                else toast.onUndo();
            }
            return prev.filter((t) => t.id !== id);
        });
    }, []);

    const requestDelete = useCallback(
        ({ message, onUndo, onCommit }: RequestDeleteArgs) => {
            const id = crypto.randomUUID();
            setToasts((prev) => [...prev, { id, message, onUndo, onCommit }]);
            timers.current.set(
                id,
                setTimeout(() => settle(id, true), UNDO_WINDOW_MS)
            );
        },
        [settle]
    );

    return (
        <UndoToastContext.Provider value={{ requestDelete }}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
                    >
                        <span>{t.message}</span>
                        <button
                            type="button"
                            onClick={() => settle(t.id, false)}
                            className="shrink-0 font-bold underline-offset-2 hover:underline"
                        >
                            Undo
                        </button>
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
