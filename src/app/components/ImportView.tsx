"use client";

import { useState } from "react";
import { type TFunction } from "@/i18n";
import { useT } from "@/i18n/I18nProvider";
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
    DANGER_BTN,
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

function parseImportText(
    text: string,
    existingAccounts: Account[],
    existingCategories: Category[],
    t: TFunction
): ParseResult {
    const errors: string[] = [];
    const rawRows: ParsedRaw[] = [];

    text.split(/\r\n|\r|\n/).forEach((line, idx) => {
        const lineNum = idx + 1;
        if (!line.trim()) return;

        const cols = line.split("\t");
        if (cols.length !== 6) {
            errors.push(t("import.errColumns", { line: lineNum, got: cols.length }));
            return;
        }

        const [dateRaw, descriptionRaw, categoryRaw, accountRaw, amountRaw, typeRaw] = cols;

        const date = parseDateDDMMYYYY(dateRaw);
        if (!date) {
            errors.push(t("import.errDate", { line: lineNum, value: dateRaw.trim() }));
            return;
        }

        const amount = parseAmountEs(amountRaw);
        if (amount === null) {
            errors.push(t("import.errAmount", { line: lineNum, value: amountRaw.trim() }));
            return;
        }

        const type = TYPE_ALIASES[typeRaw.trim().toLowerCase()];
        if (!type) {
            errors.push(t("import.errType", { line: lineNum, value: typeRaw.trim() }));
            return;
        }

        const account = accountRaw.trim();
        if (!account) {
            errors.push(t("import.errAccount", { line: lineNum }));
            return;
        }

        if (type !== "transfer" && !categoryRaw.trim()) {
            errors.push(
                t("import.errCategory", {
                    line: lineNum,
                    type: type === "income" ? t("type.income") : t("type.expense"),
                })
            );
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
            errors.push(t("import.errPair", { lines: lineList, count: group.length }));
            continue;
        }

        const [a, b] = group;
        const source = a.amount < 0 ? a : b.amount < 0 ? b : null;
        const destination = a.amount > 0 ? a : b.amount > 0 ? b : null;

        if (!source || !destination || source === destination) {
            errors.push(t("import.errSigns", { a: a.lineNum, b: b.lineNum }));
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
        errors.unshift(t("import.errTooMany", { count: rows.length, max: MAX_IMPORT_TRANSACTIONS }));
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
    const t = useT();
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
        setParsed(text.trim() ? parseImportText(text, accounts, categories, t) : null);
    }

    async function handleImport() {
        if (!parsed || parsed.errors.length > 0 || parsed.rows.length === 0) return;

        if (mode === "replace") {
            const confirmed = confirm(t("import.replaceConfirm"));
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
                setError(data.error || t("import.importFailed"));
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
            setError(t("common.networkError"));
        } finally {
            setImporting(false);
        }
    }

    const hasBlockingErrors = !!parsed && parsed.errors.length > 0;
    const canImport = !!parsed && !hasBlockingErrors && parsed.rows.length > 0 && !importing;

    return (
        <div className="space-y-4">
            <section className="surface rounded-2xl p-5">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t("import.how")}</h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                    <li>{t("import.noHeader")}</li>
                    <li>{t("import.columnOrder", { cols: t("import.columnNames") })}</li>
                    <li>
                        {t("import.datesAmounts", {
                            date: t("import.dateFormat"),
                            amount: t("import.amountExample"),
                        })}
                    </li>
                    <li>
                        {t("import.typeMustBe", {
                            income: "Income",
                            expense: "Expense",
                            transfer: "Transfer",
                        })}
                    </li>
                    <li>{t("import.transferRows")}</li>
                    <li>{t("import.unknownNames")}</li>
                    <li>{t("import.initialBalance", { name: t("import.initialBalanceName") })}</li>
                    <li>{t("import.previewFirst")}</li>
                </ul>
            </section>

            <section className="surface rounded-2xl p-5">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("import.paste")}</h2>
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
                    {t("import.preview")}
                </button>
            </section>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            {result && (
                <section className="rounded-2xl border-2 border-brand/25 bg-brand-soft p-5 shadow-sm">
                    <p className="font-bold text-brand-dark">{t("import.complete")}</p>
                    <p className="mt-1 text-sm text-brand-dark">
                        {[
                            t("import.resultTx", { count: result.imported }),
                            result.accountsCreated > 0
                                ? t("import.resultAccounts", { count: result.accountsCreated })
                                : null,
                            result.categoriesCreated > 0
                                ? t("import.resultCategories", { count: result.categoriesCreated })
                                : null,
                            result.initialBalanceRowsApplied > 0
                                ? t("import.resultBalances", { count: result.initialBalanceRowsApplied })
                                : null,
                        ]
                            .filter(Boolean)
                            .join(", ")}
                        .
                    </p>
                </section>
            )}

            {parsed && (
                <section className="surface rounded-2xl p-5">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("import.preview")}</h2>

                    {parsed.errors.length > 0 && (
                        <div className="mb-4 rounded-xl border-2 border-danger/25 bg-danger-soft p-3">
                            <p className="mb-1 text-sm font-bold text-danger">
                                {t("import.problems", { count: parsed.errors.length })}
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
                            {t("import.ready", { count: parsed.transactionCount })}
                            {parsed.dateRange && (
                                <>
                                    {" "}
                                    (
                                    {t("import.dateTo", {
                                        from: formatDate(parsed.dateRange.from),
                                        to: formatDate(parsed.dateRange.to),
                                    })}
                                    )
                                </>
                            )}
                            .
                        </p>
                        {parsed.newAccountNames.length > 0 && (
                            <p>{t("import.newAccounts", { names: parsed.newAccountNames.join(", ") })}</p>
                        )}
                        {parsed.newCategoryNames.length > 0 && (
                            <p>
                                {t("import.newCategories", {
                                    names: parsed.newCategoryNames
                                        .map(
                                            (c) =>
                                                `${c.name} (${c.type === "income" ? t("type.income") : t("type.expense")})`
                                        )
                                        .join(", "),
                                })}
                            </p>
                        )}
                        {parsed.initialBalanceCount > 0 && (
                            <p>{t("import.balanceRows", { count: parsed.initialBalanceCount })}</p>
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
                            {t("import.addToExisting")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("replace")}
                            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors duration-150 select-none ${
                                mode === "replace" ? "bg-danger text-white" : "bg-chip text-muted hover:bg-chip-hover"
                            }`}
                        >
                            {t("import.replaceEverything")}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!canImport}
                        className={`${mode === "replace" ? DANGER_BTN : PRIMARY_BTN} mt-3 w-full`}
                    >
                        {importing
                            ? t("import.importing")
                            : mode === "replace"
                              ? t("import.replaceAndImport")
                              : t("import.importBtn")}
                    </button>
                </section>
            )}
        </div>
    );
}
