"use client";

import { type Account, type Category, type Transaction, AMOUNT_MASK, eur, formatDate } from "../shared";
import { CategoryIcon } from "./icons";

function resolveName(id: string, accounts: Account[], categories: Category[]): string {
    return accounts.find((a) => a.id === id)?.name ?? categories.find((c) => c.id === id)?.name ?? "Unknown";
}

export function TransactionCard({
    tx,
    accounts,
    categories,
    privacyMode,
    onClick,
    compact = false,
}: {
    tx: Transaction;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    onClick?: () => void;
    compact?: boolean;
}) {
    const sign = tx.type === "expense" ? "-" : tx.type === "income" ? "+" : "";
    const color = tx.type === "expense" ? "text-danger" : tx.type === "income" ? "text-brand" : "text-ink";
    // Category swatches are always light pastels, in both themes — dark mode's near-white
    // "ink"/"muted"/"brand"/"danger" text would nearly vanish against them. Once a swatch is
    // tinting the row (or the icon badge, whose fallback is also a light gray), text on top
    // is pinned to these fixed light-mode-equivalent colors instead of the theme variables.
    const fixedInk = "#23221d";
    const fixedMuted = "#918c7c";
    const fixedAmountColor = tx.type === "expense" ? "#a8402f" : tx.type === "income" ? "#1f7a54" : fixedInk;
    const fromName = resolveName(tx.accountId, accounts, categories);
    const toName = resolveName(tx.destinationId, accounts, categories);
    const subtitle = tx.type === "transfer" ? `${fromName} → ${toName}` : `${toName} · ${fromName}`;
    const category = tx.type !== "transfer" ? categories.find((c) => c.id === tx.destinationId) : undefined;
    const categoryColor = category?.color ?? null;
    const categoryIcon = category?.icon ?? null;
    const Tag = onClick ? "button" : "div";

    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            style={categoryColor ? { backgroundColor: categoryColor } : undefined}
            className={
                compact
                    ? `flex w-full items-center justify-between px-4 py-2.5 text-left ${
                          onClick ? "transition-colors duration-150 hover:bg-chip" : ""
                      }`
                    : `flex w-full items-center justify-between rounded-2xl border border-line bg-paper p-4 text-left shadow-sm ${
                          onClick ? "transition-colors duration-150 hover:border-brand hover:bg-chip" : ""
                      }`
            }
        >
            <div className="flex min-w-0 items-center gap-2.5">
                {categoryIcon && (
                    <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{
                            backgroundColor: categoryColor ?? "#e5e0d8",
                            color: "rgba(35, 34, 29, 0.7)",
                            border: "1px solid rgba(35, 34, 29, 0.1)",
                        }}
                    >
                        <CategoryIcon iconKey={categoryIcon} className="h-4 w-4" />
                    </span>
                )}
                <div className="min-w-0">
                    <p
                        className={`truncate font-semibold ${categoryColor ? "" : "text-ink"}`}
                        style={categoryColor ? { color: fixedInk } : undefined}
                    >
                        {tx.description}
                    </p>
                    <p
                        className={`truncate text-xs ${categoryColor ? "" : "text-muted"}`}
                        style={categoryColor ? { color: fixedMuted } : undefined}
                    >
                        {subtitle} · {formatDate(tx.date)}
                    </p>
                </div>
            </div>
            <p
                className={`ml-3 shrink-0 font-bold ${compact ? "text-base" : "text-lg"} ${categoryColor ? "" : color}`}
                style={categoryColor ? { color: fixedAmountColor } : undefined}
            >
                {privacyMode ? AMOUNT_MASK : `${sign}${eur.format(Math.abs(tx.amount))}`}
            </p>
        </Tag>
    );
}
