"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { type Account, type Category, type CurrencyCode, type Transaction, categoryChipStyle, formatCurrency, formatDate } from "../shared";
import { useT } from "@/i18n/I18nProvider";
import { CategoryIcon, IconArrowDownRight, IconArrowLeftRight, IconArrowUpRight } from "./icons";

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;

function resolveName(id: string, accounts: Account[], categories: Category[], fallback: string): string {
    return accounts.find((a) => a.id === id)?.name ?? categories.find((c) => c.id === id)?.name ?? fallback;
}

export function TransactionCard({
    tx,
    accounts,
    categories,
    privacyMode,
    accountBalance,
    onClick,
    onLongPress,
    selected = false,
    compact = false,
    currency,
}: {
    tx: Transaction;
    accounts: Account[];
    categories: Category[];
    privacyMode: boolean;
    accountBalance?: number;
    onClick?: (event: { shiftKey: boolean }) => void;
    onLongPress?: () => void;
    selected?: boolean;
    compact?: boolean;
    currency?: CurrencyCode;
}) {
    const t = useT();
    const sign = tx.type === "expense" ? "-" : tx.type === "income" ? "+" : "";
    const color = tx.type === "expense" ? "text-danger" : tx.type === "income" ? "text-brand" : "text-ink";
    const unknown = t("common.unknown");
    const fromName = resolveName(tx.accountId, accounts, categories, unknown);
    const toName = resolveName(tx.destinationId, accounts, categories, unknown);
    const subtitle = tx.type === "transfer" ? `${fromName} → ${toName}` : `${toName} · ${fromName}`;
    const category = tx.type !== "transfer" ? categories.find((c) => c.id === tx.destinationId) : undefined;
    const categoryColor = category?.color ?? null;
    const categoryIcon = category?.icon ?? null;
    const title =
        tx.description.trim() ||
        (tx.type === "transfer" ? t("type.transfer") : (category?.name ?? toName));
    const interactive = Boolean(onClick || onLongPress);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const suppressClickRef = useRef(false);
    const ghostListenerRef = useRef<((event: Event) => void) | null>(null);
    const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function clearPress() {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startRef.current = null;
    }

    function clearGhostClick() {
        if (ghostListenerRef.current) {
            document.removeEventListener("click", ghostListenerRef.current, true);
            ghostListenerRef.current = null;
        }
        if (ghostTimerRef.current) {
            clearTimeout(ghostTimerRef.current);
            ghostTimerRef.current = null;
        }
        suppressClickRef.current = false;
    }

    useEffect(
        () => () => {
            clearPress();
            clearGhostClick();
        },
        []
    );

    function suppressGhostClick() {
        clearGhostClick();
        suppressClickRef.current = true;
        const suppress = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
        };
        ghostListenerRef.current = suppress;
        document.addEventListener("click", suppress, true);
        ghostTimerRef.current = setTimeout(clearGhostClick, 400);
    }

    function fireLongPress() {
        if (!onLongPress) return;
        suppressGhostClick();
        onLongPress();
    }

    function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
        if (!onLongPress) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        startRef.current = { x: e.clientX, y: e.clientY };
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            fireLongPress();
        }, LONG_PRESS_MS);
    }

    function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
        if (!startRef.current || !timerRef.current) return;
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearPress();
    }

    function handleClick(e: MouseEvent<HTMLButtonElement>) {
        if (suppressClickRef.current) {
            e.preventDefault();
            return;
        }
        onClick?.({ shiftKey: e.shiftKey });
    }

    function handleContextMenu(e: MouseEvent<HTMLButtonElement>) {
        if (!onLongPress) return;
        e.preventDefault();
        if (suppressClickRef.current) return;
        clearPress();
        fireLongPress();
    }

    const selectedCls = selected
        ? "bg-brand/10 shadow-[inset_3px_0_0_0_var(--color-brand)]"
        : interactive
          ? compact
            ? "hover:bg-chip/70"
            : "hover:brightness-[1.01]"
          : "";

    const className = compact
        ? `flex w-full items-center justify-between px-4 py-2.5 text-left transition-all duration-150 ${
              onLongPress ? "select-none [-webkit-touch-callout:none]" : ""
          } ${selectedCls}`
        : `group surface flex w-full items-center justify-between rounded-2xl p-4 text-left transition-all duration-150 ${selectedCls}`;

    const body = (
        <>
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
                    {formatCurrency(Math.abs(tx.amount), privacyMode, currency)}
                </p>
                {accountBalance !== undefined && (
                    <p
                        className={`mt-0.5 text-xs tabular-nums leading-tight text-muted transition-[filter,opacity] duration-250 ${
                            privacyMode ? "blur-[5px] select-none opacity-70" : ""
                        }`}
                    >
                        {formatCurrency(accountBalance, privacyMode, currency)}
                    </p>
                )}
            </div>
        </>
    );

    if (!interactive) {
        return <div className={className}>{body}</div>;
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            onPointerDown={onLongPress ? handlePointerDown : undefined}
            onPointerMove={onLongPress ? handlePointerMove : undefined}
            onPointerUp={onLongPress ? clearPress : undefined}
            onPointerCancel={onLongPress ? clearPress : undefined}
            onContextMenu={onLongPress ? handleContextMenu : undefined}
            aria-pressed={selected || undefined}
            className={className}
        >
            {body}
        </button>
    );
}
