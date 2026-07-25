"use client";

import { useState } from "react";
import { type Account, formatCurrency } from "../shared";
import { IconClose, IconPencil } from "./icons";

export function AccountList({
    items,
    privacyMode,
    onRename,
    onSetInitialBalance,
    onDelete,
}: {
    items: Account[];
    privacyMode: boolean;
    onRename: (a: Account, name: string) => void;
    onSetInitialBalance: (a: Account, rawValue: string) => void;
    onDelete: (a: Account) => void;
}) {
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState("");
    const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
    const [editingBalanceValue, setEditingBalanceValue] = useState("");

    function startEditingName(a: Account) {
        setEditingNameId(a.id);
        setEditingNameValue(a.name);
    }

    function commitEditingName(a: Account) {
        const trimmed = editingNameValue.trim();
        if (trimmed && trimmed !== a.name) {
            onRename(a, trimmed);
        }
        setEditingNameId(null);
    }

    function startEditingBalance(a: Account) {
        setEditingBalanceId(a.id);
        setEditingBalanceValue(String(a.initialBalance));
    }

    function commitEditingBalance(a: Account) {
        const trimmed = editingBalanceValue.trim();
        if (trimmed && trimmed !== String(a.initialBalance)) {
            onSetInitialBalance(a, trimmed);
        }
        setEditingBalanceId(null);
    }

    if (items.length === 0) {
        return <p className="text-sm text-muted">No accounts yet.</p>;
    }

    return (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {items.map((a) => (
                <div key={a.id} className="flex items-center gap-1 bg-paper px-3 py-2.5">
                    {editingNameId === a.id ? (
                        <input
                            autoFocus
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => commitEditingName(a)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitEditingName(a);
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingNameId(null);
                                }
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                    ) : (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{a.name}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => startEditingName(a)}
                        aria-label={`Rename ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                    >
                        <IconPencil className="h-4 w-4" />
                    </button>
                    {editingBalanceId === a.id ? (
                        <input
                            autoFocus
                            inputMode="decimal"
                            value={editingBalanceValue}
                            onChange={(e) => setEditingBalanceValue(e.target.value)}
                            onBlur={() => commitEditingBalance(a)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitEditingBalance(a);
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingBalanceId(null);
                                }
                            }}
                            className="w-24 shrink-0 rounded-lg border border-line bg-paper px-2 py-1 text-right text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                    ) : (
                        <span className="shrink-0 text-sm text-muted">
                            Starts at {formatCurrency(a.initialBalance, privacyMode)}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => startEditingBalance(a)}
                        aria-label={`Edit initial balance for ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                    >
                        <IconPencil className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(a)}
                        aria-label={`Delete ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                    >
                        <IconClose className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
