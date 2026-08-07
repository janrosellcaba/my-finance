"use client";

import { useState } from "react";
import { type Account, ACCOUNT_ICON_KEYS, formatCurrency } from "../shared";
import { ACCOUNT_ICON_COMPONENTS, AccountIcon, IconClose, IconPencil, IconRadioDot } from "./icons";

export function AccountList({
    items,
    privacyMode,
    onRename,
    onSetInitialBalance,
    onSetDefault,
    onSetIcon,
    onDelete,
}: {
    items: Account[];
    privacyMode: boolean;
    onRename: (a: Account, name: string) => void;
    onSetInitialBalance: (a: Account, rawValue: string) => void;
    onSetDefault: (a: Account) => void;
    onSetIcon: (a: Account, icon: string | null) => void;
    onDelete: (a: Account) => void;
}) {
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState("");
    const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
    const [editingBalanceValue, setEditingBalanceValue] = useState("");
    const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

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
                <div key={a.id} className="bg-paper">
                <div className="flex items-center gap-1 px-3 py-2.5">
                    <button
                        type="button"
                        onClick={() => onSetDefault(a)}
                        role="radio"
                        aria-checked={a.isDefault}
                        title={a.isDefault ? "Default account" : "Set as default"}
                        aria-label={a.isDefault ? `${a.name} is the default` : `Set ${a.name} as default`}
                        className={`shrink-0 rounded-full p-1.5 transition-colors duration-150 ${
                            a.isDefault ? "text-brand" : "text-muted hover:text-ink"
                        }`}
                    >
                        <IconRadioDot className="h-4 w-4" checked={a.isDefault} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIconPickerFor(iconPickerFor === a.id ? null : a.id)}
                        aria-label={`Change icon for ${a.name}`}
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors duration-150 hover:text-ink"
                    >
                        {a.icon ? (
                            <AccountIcon iconKey={a.icon} className="h-4 w-4" />
                        ) : (
                            <span className="block h-4 w-4 rounded border border-dashed border-line" />
                        )}
                    </button>
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
                {iconPickerFor === a.id && (
                    <div className="flex flex-wrap gap-2 border-t border-line bg-chip px-3 py-3">
                        <button
                            type="button"
                            onClick={() => {
                                onSetIcon(a, null);
                                setIconPickerFor(null);
                            }}
                            aria-label={`Remove icon from ${a.name}`}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-paper transition-transform duration-150 hover:scale-110 ${
                                a.icon === null ? "border-ink" : "border-white/60"
                            }`}
                        >
                            <IconClose className="h-3.5 w-3.5 text-muted" />
                        </button>
                        {ACCOUNT_ICON_KEYS.map((key) => {
                            const Icon = ACCOUNT_ICON_COMPONENTS[key];
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        onSetIcon(a, key);
                                        setIconPickerFor(null);
                                    }}
                                    aria-label={`Set ${a.name} icon to ${key}`}
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-paper text-ink transition-transform duration-150 hover:scale-110 ${
                                        a.icon === key ? "border-ink" : "border-white/60"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            );
                        })}
                    </div>
                )}
                </div>
            ))}
        </div>
    );
}
