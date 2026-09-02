"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
    type Account,
    type Category,
    type DescriptionSuggestion,
    type Transaction,
    type TransactionType,
    currencySymbol,
    formatCurrency,
    getTodayLocalDateISO,
    INPUT_CLS,
    PRIMARY_BTN,
    parseAmountInput,
} from "../shared";
import { IconClose } from "./icons";
import { enqueueOutbox } from "@/lib/offlineStore";

export function AddTransactionModal({
    accounts,
    categories,
    transaction,
    onClose,
    onSaved,
    onDelete,
}: {
    accounts: Account[];
    categories: Category[];
    transaction?: Transaction;
    onClose: () => void;
    onSaved: () => void;
    onDelete?: (transaction: Transaction) => void;
}) {
    const isEditing = !!transaction;

    function defaultCategoryFor(t: "income" | "expense"): string {
        return categories.find((c) => c.type === t && c.isDefault)?.id ?? "";
    }

    const [date, setDate] = useState(() => transaction?.date ?? getTodayLocalDateISO());
    const [description, setDescription] = useState(transaction?.description ?? "");
    const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
    const [accountId, setAccountId] = useState(
        transaction?.accountId ?? accounts.find((a) => a.isDefault)?.id ?? ""
    );
    const [destinationId, setDestinationId] = useState(transaction ? transaction.destinationId : defaultCategoryFor("expense"));
    const [amount, setAmount] = useState(transaction ? String(Math.abs(transaction.amount)) : "");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [suggestions, setSuggestions] = useState<DescriptionSuggestion[]>([]);
    const [listOpen, setListOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [descFocused, setDescFocused] = useState(false);
    const lastAppliedDescription = useRef<string | null>(null);
    const listboxId = useId();

    useEffect(() => {
        function handleKeyDown(e: globalThis.KeyboardEvent) {
            if (e.key !== "Escape") return;
            if (listOpen) {
                e.preventDefault();
                setListOpen(false);
                return;
            }
            onClose();
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, listOpen]);

    useEffect(() => {
        const q = description.trim();
        if (lastAppliedDescription.current !== null && q === lastAppliedDescription.current) {
            return;
        }
        lastAppliedDescription.current = null;
        if (!descFocused || q.length < 2) {
            setSuggestions([]);
            setListOpen(false);
            return;
        }

        const ac = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q });
                if (transaction?.id) params.set("exclude", transaction.id);
                const res = await fetch(`/api/transactions/suggestions?${params}`, { signal: ac.signal });
                const data = (await res.json()) as { success?: boolean; suggestions?: DescriptionSuggestion[] };
                if (!data.success || !data.suggestions) return;
                setSuggestions(data.suggestions);
                setHighlight(0);
                setListOpen(data.suggestions.length > 0);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
            }
        }, 180);

        return () => {
            window.clearTimeout(timer);
            ac.abort();
        };
    }, [description, descFocused, transaction?.id]);

    const destinationOptions: { id: string; name: string }[] =
        type === "transfer" ? accounts.filter((a) => a.id !== accountId) : categories.filter((c) => c.type === type);

    function handleTypeChange(next: TransactionType) {
        setType(next);
        setDestinationId(isEditing || next === "transfer" ? "" : defaultCategoryFor(next));
    }

    function applySuggestion(s: DescriptionSuggestion) {
        lastAppliedDescription.current = s.description;
        setDescription(s.description);
        setType(s.type);
        if (accounts.some((a) => a.id === s.accountId)) {
            setAccountId(s.accountId);
        }
        const destExists =
            s.type === "transfer"
                ? accounts.some((a) => a.id === s.destinationId)
                : categories.some((c) => c.id === s.destinationId);
        if (destExists) {
            setDestinationId(s.destinationId);
        } else if (s.type !== "transfer") {
            setDestinationId(defaultCategoryFor(s.type));
        } else {
            setDestinationId("");
        }
        setAmount(String(Math.abs(s.amount)));
        setSuggestions([]);
        setListOpen(false);
    }

    function handleDescriptionKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (!listOpen || suggestions.length === 0) {
            if (e.key === "ArrowDown" && suggestions.length > 0) {
                e.preventDefault();
                setListOpen(true);
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => (i + 1) % suggestions.length);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => (i - 1 + suggestions.length) % suggestions.length);
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            const picked = suggestions[highlight];
            if (picked) applySuggestion(picked);
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        const amountNum = parseAmountInput(amount);

        if (!date) {
            setError("Please fill in the date.");
            return;
        }
        if (!accountId) {
            setError("Please choose an account.");
            return;
        }
        if (!destinationId) {
            setError(type === "transfer" ? "Please choose a destination account." : "Please choose a category.");
            return;
        }
        if (type === "transfer" && accountId === destinationId) {
            setError("Source and destination accounts must be different.");
            return;
        }
        if (amountNum === null || amountNum <= 0) {
            setError("Please enter an amount greater than zero.");
            return;
        }

        let desc = description.trim();
        if (!desc) {
            desc =
                type === "transfer"
                    ? "Transfer"
                    : (categories.find((c) => c.id === destinationId)?.name ?? "");
        }

        const payload = {
            ...(isEditing ? { id: transaction!.id } : { id: crypto.randomUUID() }),
            date,
            description: desc,
            type,
            amount: amountNum,
            accountId,
            destinationId,
        };

        if (typeof navigator !== "undefined" && !navigator.onLine && !isEditing) {
            await enqueueOutbox({ id: payload.id as string, type: "transaction", payload });
            setSaving(false);
            onSaved();
            return;
        }

        try {
            const res = await fetch("/api/transactions", {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not save transaction.");
                setSaving(false);
                return;
            }
            onSaved();
        } catch {
            if (!isEditing) {
                await enqueueOutbox({ id: payload.id as string, type: "transaction", payload });
                setSaving(false);
                onSaved();
                return;
            }
            setError("Network error. Please try again.");
            setSaving(false);
        }
    }

    function handleDelete() {
        if (!transaction) return;
        onDelete?.(transaction);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                role="dialog"
                aria-modal="true"
                aria-label={isEditing ? "Edit Transaction" : "Add Transaction"}
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto surface rounded-t-3xl p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-muted/25 sm:hidden" />
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">{isEditing ? "Edit Transaction" : "Add Transaction"}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                    {(["income", "expense", "transfer"] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => handleTypeChange(t)}
                            className={`rounded-xl py-3 text-sm font-bold capitalize transition-colors duration-150 select-none ${
                                type === t
                                    ? t === "income"
                                        ? "bg-brand text-white"
                                        : t === "expense"
                                          ? "bg-danger text-white"
                                          : "bg-ink text-paper"
                                    : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Date</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
                </label>

                <label className="relative mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Description</span>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={() => setDescFocused(true)}
                        onBlur={() => {
                            setDescFocused(false);
                            window.setTimeout(() => setListOpen(false), 120);
                        }}
                        onKeyDown={handleDescriptionKeyDown}
                        placeholder="e.g. Groceries"
                        autoComplete="off"
                        autoCorrect="off"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={listOpen && suggestions.length > 0}
                        aria-controls={listboxId}
                        aria-activedescendant={
                            listOpen && suggestions[highlight] ? `${listboxId}-${highlight}` : undefined
                        }
                        className={INPUT_CLS}
                    />
                    {listOpen && suggestions.length > 0 && (
                        <ul
                            id={listboxId}
                            role="listbox"
                            aria-label="Past descriptions"
                            className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-line bg-paper shadow-lg"
                        >
                            {suggestions.map((s, i) => {
                                const fromName = accounts.find((a) => a.id === s.accountId)?.name ?? "Account";
                                const toName =
                                    s.type === "transfer"
                                        ? (accounts.find((a) => a.id === s.destinationId)?.name ?? "Account")
                                        : (categories.find((c) => c.id === s.destinationId)?.name ?? "Category");
                                const subtitle =
                                    s.type === "transfer"
                                        ? `${fromName} → ${toName}`
                                        : `${toName} · ${fromName}`;
                                const amountCls =
                                    s.type === "expense"
                                        ? "text-danger"
                                        : s.type === "income"
                                          ? "text-brand"
                                          : "text-ink";
                                const sign = s.type === "expense" ? "−" : s.type === "income" ? "+" : "";
                                return (
                                    <li key={`${s.description}-${s.accountId}-${s.destinationId}-${s.type}`} role="presentation">
                                        <button
                                            type="button"
                                            id={`${listboxId}-${i}`}
                                            role="option"
                                            aria-selected={i === highlight}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onMouseEnter={() => setHighlight(i)}
                                            onClick={() => applySuggestion(s)}
                                            className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 ${
                                                i === highlight ? "bg-chip" : "hover:bg-chip/70"
                                            }`}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-ink">{s.description}</span>
                                                <span className="block truncate text-xs text-muted">{subtitle}</span>
                                            </span>
                                            <span className={`shrink-0 text-sm font-bold tabular-nums ${amountCls}`}>
                                                {sign}
                                                {formatCurrency(Math.abs(s.amount))}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">
                        Amount ({currencySymbol()})
                    </span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{type === "transfer" ? "From Account" : "Account"}</span>
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={INPUT_CLS}>
                        <option value="">Select an account</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">{type === "transfer" ? "To Account" : "Category"}</span>
                    <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={INPUT_CLS}>
                        <option value="">{type === "transfer" ? "Select destination account" : "Select a category"}</option>
                        {destinationOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </select>
                </label>

                {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

                <button type="submit" disabled={saving} className={`${PRIMARY_BTN} w-full`}>
                    {saving ? "Saving…" : isEditing ? "Save Changes" : "Save Transaction"}
                </button>

                {isEditing && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving}
                        className="mt-3 w-full rounded-2xl border-2 border-danger/25 bg-danger-soft py-4 text-lg font-bold text-danger transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-danger/40 hover:shadow-md active:translate-y-0 disabled:opacity-60 select-none"
                    >
                        Delete Transaction
                    </button>
                )}
            </form>
        </div>
    );
}
