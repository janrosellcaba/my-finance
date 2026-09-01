"use client";

import { type Account, type Category, type Transaction, categoryChipStyle, formatCurrency, formatDate } from "../shared";
import { CategoryIcon, IconArrowDownRight, IconArrowLeftRight, IconArrowUpRight } from "./icons";

function resolveName(id: string, accounts: Account[], categories: Category[]): string {
    return accounts.find((a) => a.id === id)?.name ?? categories.find((c) => c.id === id)?.name ?? "Unknown";
}

export function TransactionCard({
    tx,
    accounts,
    categories,
    privacyMode,
    accountBalance,
    onClick,
    compact = false,
}: {
    tx: Transaction;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    accountBalance?: number;
    onClick?: () => void;
    compact?: boolean;
}) {
    const sign = tx.type === "expense" ? "-" : tx.type === "income" ? "+" : "";
    const color = tx.type === "expense" ? "text-danger" : tx.type === "income" ? "text-brand" : "text-ink";
    const fromName = resolveName(tx.accountId, accounts, categories);
    const toName = resolveName(tx.destinationId, accounts, categories);
    const subtitle = tx.type === "transfer" ? `${fromName} → ${toName}` : `${toName} · ${fromName}`;
    const category = tx.type !== "transfer" ? categories.find((c) => c.id === tx.destinationId) : undefined;
    const categoryColor = category?.color ?? null;
    const categoryIcon = category?.icon ?? null;
    const title =
        tx.description.trim() ||
        (tx.type === "transfer" ? "Transfer" : (category?.name ?? toName));
    const Tag = onClick ? "button" : "div";

    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={
                compact
                    ? `flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors duration-150 ${
                          onClick ? "hover:bg-chip/70" : ""
                      }`
                    : `group surface flex w-full items-center justify-between rounded-2xl p-4 text-left transition-all duration-150 ${
                          onClick ? "hover:brightness-[1.01]" : ""
                      }`
            }
        >
            <div className="flex min-w-0 items-center gap-3">
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105"
                    style={categoryColor ? categoryChipStyle(categoryColor) : undefined}
                >
                    {categoryIcon ? (
                        <span className="flex h-full w-full items-center justify-center rounded-xl">
                            <CategoryIcon iconKey={categoryIcon} className="h-4.5 w-4.5" />
                        </span>
                    ) : tx.type === "income" ? (
                        <span className="flex h-full w-full items-center justify-center rounded-xl bg-brand-soft text-brand">
                            <IconArrowUpRight className="h-4.5 w-4.5" />
                        </span>
                    ) : tx.type === "transfer" ? (
                        <span className="flex h-full w-full items-center justify-center rounded-xl bg-chip text-muted">
                            <IconArrowLeftRight className="h-4.5 w-4.5" />
                        </span>
                    ) : (
                        <span className="flex h-full w-full items-center justify-center rounded-xl bg-danger-soft text-danger">
                            <IconArrowDownRight className="h-4.5 w-4.5" />
                        </span>
                    )}
                </span>
                <div className="min-w-0">
                    <p className="truncate font-semibold text-ink leading-tight">
                        {title}
                    </p>
                    <p className="truncate text-xs text-muted mt-0.5">
                        {subtitle} · {formatDate(tx.date)}
                    </p>
                </div>
            </div>
            <div className="ml-3 shrink-0 text-right">
                <p
                    className={`font-bold tabular-nums leading-tight transition-[filter,opacity] duration-250 ${
                        compact ? "text-base" : "text-lg"
                    } ${color} ${privacyMode ? "blur-[6px] select-none opacity-70" : ""}`}
                >
                    {sign}
                    {formatCurrency(Math.abs(tx.amount))}
                </p>
                {accountBalance !== undefined && (
                    <p
                        className={`mt-0.5 text-xs tabular-nums leading-tight text-muted transition-[filter,opacity] duration-250 ${
                            privacyMode ? "blur-[5px] select-none opacity-70" : ""
                        }`}
                    >
                        {formatCurrency(accountBalance)}
                    </p>
                )}
            </div>
        </Tag>
    );
}
