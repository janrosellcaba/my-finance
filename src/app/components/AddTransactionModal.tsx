"use client";

import { useState, type FormEvent } from "react";
import {
    type Account,
    type Category,
    type Transaction,
    type TransactionType,
    INPUT_CLS,
    PRIMARY_BTN,
} from "../shared";
import { IconClose } from "./icons";

export function AddTransactionModal({
    accounts,
    categories,
    transaction,
    onClose,
    onSaved,
}: {
    accounts: Account[];
    categories: Category[];
    transaction?: Transaction;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEditing = !!transaction;

    function defaultCategoryFor(t: "income" | "expense"): string {
        return categories.find((c) => c.type === t && c.isDefault)?.id ?? "";
    }

    const [date, setDate] = useState(() => transaction?.date ?? new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState(transaction?.description ?? "");
    const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
    const [accountId, setAccountId] = useState(transaction?.accountId ?? "");
    const [destinationId, setDestinationId] = useState(transaction ? transaction.destinationId : defaultCategoryFor("expense"));
    const [amount, setAmount] = useState(transaction ? String(Math.abs(transaction.amount)) : "");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const destinationOptions: { id: string; name: string }[] =
        type === "transfer" ? accounts.filter((a) => a.id !== accountId) : categories.filter((c) => c.type === type);

    function handleTypeChange(next: TransactionType) {
        setType(next);
        setDestinationId(isEditing || next === "transfer" ? "" : defaultCategoryFor(next));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        const amountNum = parseFloat(amount);

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
        if (!amountNum || amountNum <= 0) {
            setError("Please enter an amount greater than zero.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/transactions", {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(isEditing ? { id: transaction!.id } : {}),
                    date,
                    description: description.trim(),
                    type,
                    amount: amountNum,
                    accountId,
                    destinationId,
                }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not save transaction.");
                setSaving(false);
                return;
            }
            onSaved();
        } catch {
            setError("Network error. Please try again.");
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!transaction) return;
        if (!confirm("Delete this transaction? This cannot be undone.")) return;

        setError("");
        setDeleting(true);
        try {
            const res = await fetch("/api/transactions", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: transaction.id }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                setError(data.error || "Could not delete transaction.");
                setDeleting(false);
                return;
            }
            onSaved();
        } catch {
            setError("Network error. Please try again.");
            setDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-xl sm:rounded-3xl"
            >
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
                                          : "bg-ink text-white"
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

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Description</span>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. Groceries"
                        className={INPUT_CLS}
                    />
                </label>

                <label className="mb-3 block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Amount (€)</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
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

                <button type="submit" disabled={saving || deleting} className={`${PRIMARY_BTN} w-full bg-brand hover:bg-brand-dark`}>
                    {saving ? "Saving…" : isEditing ? "Save Changes" : "Save Transaction"}
                </button>

                {isEditing && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving || deleting}
                        className="mt-3 w-full rounded-2xl border-2 border-danger/25 bg-danger-soft py-4 text-lg font-bold text-danger transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-danger/40 hover:shadow-md active:translate-y-0 disabled:opacity-60 select-none"
                    >
                        {deleting ? "Deleting…" : "Delete Transaction"}
                    </button>
                )}
            </form>
        </div>
    );
}
