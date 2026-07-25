"use client";

import { useState } from "react";
import {
    type Account,
    type Category,
    formatDate,
    isInitialBalanceRow as isInitialBalanceRowShared,
    parseAmountEs,
    parseDateDDMMYYYY,
    INPUT_CLS,
    INK_BTN,
    MAX_IMPORT_TRANSACTIONS,
    PRIMARY_BTN,
} from "../shared";

type TransactionType = "income" | "expense" | "transfer";

type ImportRow = {
    date: string;
    description: string;
    type: TransactionType;
    amount: number;
    accountName: string;
    destinationName: string;
};

type ParsedRaw = {
    lineNum: number;
    date: string;
    description: string;
    category: string;
    account: string;
    amount: number;
    type: TransactionType;
};

type ParseResult = {
    rows: ImportRow[];
    errors: string[];
    newAccountNames: string[];
    newCategoryNames: { name: string; type: "income" | "expense" }[];
    initialBalanceCount: number;
    transactionCount: number;
    dateRange: { from: string; to: string } | null;
};

const TYPE_ALIASES: Record<string, TransactionType> = {
    income: "income",
    expense: "expense",
    transfer: "transfer",
};

function isInitialBalanceRow(row: ImportRow): boolean {
    return isInitialBalanceRowShared(row.type, row.destinationName);
}

function parseImportText(text: string, existingAccounts: Account[], existingCategories: Category[]): ParseResult {
    const errors: string[] = [];
    const rawRows: ParsedRaw[] = [];

    text.split(/\r\n|\r|\n/).forEach((line, idx) => {
        const lineNum = idx + 1;
        if (!line.trim()) return;

        const cols = line.split("\t");
        if (cols.length !== 6) {
            errors.push(
                `Row ${lineNum}: expected 6 columns (Date, Description, Category, Account, Amount, Type), got ${cols.length}.`
            );
            return;
        }

        const [dateRaw, descriptionRaw, categoryRaw, accountRaw, amountRaw, typeRaw] = cols;

        const date = parseDateDDMMYYYY(dateRaw);
        if (!date) {
            errors.push(`Row ${lineNum}: invalid date "${dateRaw.trim()}" (expected DD/MM/YYYY).`);
            return;
        }

        const amount = parseAmountEs(amountRaw);
        if (amount === null) {
            errors.push(`Row ${lineNum}: invalid amount "${amountRaw.trim()}".`);
            return;
        }

        const type = TYPE_ALIASES[typeRaw.trim().toLowerCase()];
        if (!type) {
            errors.push(`Row ${lineNum}: invalid type "${typeRaw.trim()}" (expected Income, Expense, or Transfer).`);
            return;
        }

        const account = accountRaw.trim();
        if (!account) {
            errors.push(`Row ${lineNum}: missing account name.`);
            return;
        }

        if (type !== "transfer" && !categoryRaw.trim()) {
            errors.push(`Row ${lineNum}: missing category for a ${type} transaction.`);
            return;
        }

        rawRows.push({
            lineNum,
            date,
            description: descriptionRaw.trim(),
            category: categoryRaw.trim(),
            account,
            amount,
            type,
        });
    });

    const rows: ImportRow[] = [];

    for (const r of rawRows.filter((r) => r.type !== "transfer")) {
        rows.push({
            date: r.date,
            description: r.description,
            type: r.type,
            amount: Math.abs(r.amount),
            accountName: r.account,
            destinationName: r.category,
        });
    }

    const transferGroups = new Map<string, ParsedRaw[]>();
    for (const r of rawRows.filter((r) => r.type === "transfer")) {
        const key = `${r.date}|${Math.abs(r.amount).toFixed(2)}`;
        const group = transferGroups.get(key) ?? [];
        group.push(r);
        transferGroups.set(key, group);
    }

    for (const group of transferGroups.values()) {
        if (group.length !== 2) {
            const lineList = group.map((r) => r.lineNum).join(", ");
            errors.push(
                `Row(s) ${lineList}: could not pair ${group.length} Transfer row(s) with the same date and amount (need exactly 2, one negative and one positive).`
            );
            continue;
        }

        const [a, b] = group;
        const source = a.amount < 0 ? a : b.amount < 0 ? b : null;
        const destination = a.amount > 0 ? a : b.amount > 0 ? b : null;

        if (!source || !destination || source === destination) {
            errors.push(
                `Rows ${a.lineNum}, ${b.lineNum}: paired Transfer rows must have opposite signs (one negative, one positive).`
            );
            continue;
        }

        rows.push({
            date: source.date,
            description: source.description || destination.description,
            type: "transfer",
            amount: Math.abs(source.amount),
            accountName: source.account,
            destinationName: destination.account,
        });
    }

    const existingAccountNames = new Set(existingAccounts.map((a) => a.name.trim().toLowerCase()));
    const existingCategoryKeys = new Set(existingCategories.map((c) => `${c.type}:${c.name.trim().toLowerCase()}`));

    const newAccountNamesSet = new Set<string>();
    const newCategoryMap = new Map<string, { name: string; type: "income" | "expense" }>();

    let initialBalanceCount = 0;

    for (const row of rows) {
        if (!existingAccountNames.has(row.accountName.trim().toLowerCase())) {
            newAccountNamesSet.add(row.accountName.trim());
        }
        if (row.type === "transfer") {
            if (!existingAccountNames.has(row.destinationName.trim().toLowerCase())) {
                newAccountNamesSet.add(row.destinationName.trim());
            }
        } else if (isInitialBalanceRow(row)) {
            initialBalanceCount++;
        } else {
            const key = `${row.type}:${row.destinationName.trim().toLowerCase()}`;
            if (!existingCategoryKeys.has(key) && !newCategoryMap.has(key)) {
                newCategoryMap.set(key, { name: row.destinationName.trim(), type: row.type });
            }
        }
    }

    const dates = rows.map((r) => r.date).sort();
    const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null;

    if (rows.length > MAX_IMPORT_TRANSACTIONS) {
        errors.unshift(
            `Too many rows (${rows.length}). Import at most ${MAX_IMPORT_TRANSACTIONS} transactions at a time — split this into multiple imports.`
        );
    }

    return {
        rows,
        errors,
        newAccountNames: Array.from(newAccountNamesSet),
        newCategoryNames: Array.from(newCategoryMap.values()),
        initialBalanceCount,
        transactionCount: rows.length - initialBalanceCount,
        dateRange,
    };
}

export function ImportView({
    accounts,
    categories,
    onImported,
}: {
    accounts: Account[];
    categories: Category[];
    onImported: () => void;
}) {
    const [text, setText] = useState("");
    const [parsed, setParsed] = useState<ParseResult | null>(null);
    const [mode, setMode] = useState<"merge" | "replace">("merge");
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{
        imported: number;
        accountsCreated: number;
        categoriesCreated: number;
        initialBalanceRowsApplied: number;
    } | null>(null);
    const [error, setError] = useState("");

    function handlePreview() {
        setError("");
        setResult(null);
        setParsed(text.trim() ? parseImportText(text, accounts, categories) : null);
    }

    async function handleImport() {
        if (!parsed || parsed.errors.length > 0 || parsed.rows.length === 0) return;

        if (mode === "replace") {
            const confirmed = confirm(
                "This will permanently delete ALL your existing accounts, categories, and transactions, then replace them with the pasted data. This cannot be undone. Continue?"
            );
            if (!confirmed) return;
        }

        setImporting(true);
        setError("");
        try {
            const res = await fetch("/api/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, transactions: parsed.rows }),
            });
            const data = (await res.json()) as {
                error?: string;
                imported?: number;
                accountsCreated?: number;
                categoriesCreated?: number;
                initialBalanceRowsApplied?: number;
            };
            if (!res.ok) {
                setError(data.error || "Could not import your data.");
                return;
            }
            setResult({
                imported: data.imported ?? parsed.transactionCount,
                accountsCreated: data.accountsCreated ?? 0,
                categoriesCreated: data.categoriesCreated ?? 0,
                initialBalanceRowsApplied: data.initialBalanceRowsApplied ?? 0,
            });
            setText("");
            setParsed(null);
            onImported();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setImporting(false);
        }
    }

    const hasBlockingErrors = !!parsed && parsed.errors.length > 0;
    const canImport = !!parsed && !hasBlockingErrors && parsed.rows.length > 0 && !importing;

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">How it works</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                    <li>Copy your transaction rows from Excel — data rows only, no header row.</li>
                    <li>
                        Columns must be in this exact order:{" "}
                        <span className="font-semibold text-ink">Date, Description, Category, Account, Amount, Type</span>.
                    </li>
                    <li>
                        Dates as <span className="font-semibold text-ink">DD/MM/YYYY</span> and amounts like{" "}
                        <span className="font-semibold text-ink">-68,99 €</span>.
                    </li>
                    <li>Type must be Income, Expense, or Transfer.</li>
                    <li>Each Transfer needs two rows: one negative on the source account, one positive on the destination account.</li>
                    <li>
                        Use category <span className="font-semibold text-ink">Initial Balance</span> (as Income) to
                        add to an account&apos;s starting balance instead of creating a transaction — importing the
                        same row twice adds twice, it doesn&apos;t just set the value once.
                    </li>
                </ul>
            </section>

            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Paste your data</h2>
                <textarea
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setParsed(null);
                        setResult(null);
                    }}
                    placeholder={"11/07/2026\tdinar + prote\tFood & Drinks\tImagin Main\t-7,00 €\tExpense"}
                    rows={8}
                    className={`${INPUT_CLS} font-mono text-xs`}
                />
                <button type="button" onClick={handlePreview} disabled={!text.trim()} className={`${INK_BTN} mt-3 w-full`}>
                    Preview
                </button>
            </section>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {result && (
                <section className="rounded-2xl border-2 border-brand/25 bg-brand-soft p-5 shadow-sm">
                    <p className="font-bold text-brand-dark">Import complete!</p>
                    <p className="mt-1 text-sm text-brand-dark">
                        {result.imported} transactions imported
                        {result.accountsCreated > 0 ? `, ${result.accountsCreated} new account(s)` : ""}
                        {result.categoriesCreated > 0 ? `, ${result.categoriesCreated} new category(ies)` : ""}
                        {result.initialBalanceRowsApplied > 0
                            ? `, ${result.initialBalanceRowsApplied} row(s) added to an account's initial balance`
                            : ""}
                        .
                    </p>
                </section>
            )}

            {parsed && (
                <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Preview</h2>

                    {parsed.errors.length > 0 && (
                        <div className="mb-4 rounded-xl border-2 border-danger/25 bg-danger-soft p-3">
                            <p className="mb-1 text-sm font-bold text-danger">
                                {parsed.errors.length} problem{parsed.errors.length === 1 ? "" : "s"} found — fix these in
                                Excel and paste again:
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
                                {parsed.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-1.5 text-sm text-ink">
                        <p>
                            <span className="font-semibold">{parsed.transactionCount}</span> transactions ready to import
                            {parsed.dateRange && (
                                <>
                                    {" "}
                                    (<span className="font-semibold">{formatDate(parsed.dateRange.from)}</span> to{" "}
                                    <span className="font-semibold">{formatDate(parsed.dateRange.to)}</span>)
                                </>
                            )}
                            .
                        </p>
                        {parsed.newAccountNames.length > 0 && (
                            <p>
                                New accounts: <span className="font-semibold">{parsed.newAccountNames.join(", ")}</span>
                            </p>
                        )}
                        {parsed.newCategoryNames.length > 0 && (
                            <p>
                                New categories:{" "}
                                <span className="font-semibold">
                                    {parsed.newCategoryNames.map((c) => `${c.name} (${c.type})`).join(", ")}
                                </span>
                            </p>
                        )}
                        {parsed.initialBalanceCount > 0 && (
                            <p>
                                <span className="font-semibold">{parsed.initialBalanceCount}</span> row
                                {parsed.initialBalanceCount === 1 ? "" : "s"} will add to an account&apos;s initial
                                balance instead of creating a transaction.
                            </p>
                        )}
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setMode("merge")}
                            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors duration-150 select-none ${
                                mode === "merge" ? "bg-brand text-white" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            Add to existing data
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("replace")}
                            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors duration-150 select-none ${
                                mode === "replace" ? "bg-danger text-white" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            Replace everything
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!canImport}
                        className={`${PRIMARY_BTN} mt-3 w-full ${
                            mode === "replace" ? "bg-danger hover:bg-danger-dark" : "bg-brand hover:bg-brand-dark"
                        }`}
                    >
                        {importing ? "Importing…" : mode === "replace" ? "Replace and Import" : "Import"}
                    </button>
                </section>
            )}
        </div>
    );
}
