"use client";

import { useEffect, useState } from "react";
import { INPUT_CLS } from "../../shared";
import { useT } from "@/i18n/I18nProvider";
import type { MarketSearchResult } from "@/lib/marketsTypes";
import { IconClose, IconSearch } from "../icons";
import { assetTypeLabel } from "./labels";

// Verified against the provider (daily candles available, EUR-quoted unless stated).
const SUGGESTIONS: MarketSearchResult[] = [
    { symbol: "VWCE.DE", name: "Vanguard FTSE All-World UCITS ETF (Acc)", type: "etf", exchange: "XETRA" },
    { symbol: "EUNL.DE", name: "iShares Core MSCI World UCITS ETF (Acc)", type: "etf", exchange: "XETRA" },
    { symbol: "EUNM.DE", name: "iShares MSCI Emerging Markets UCITS ETF", type: "etf", exchange: "XETRA" },
    { symbol: "^NDX", name: "Nasdaq-100", type: "index", exchange: null },
    { symbol: "ETH-EUR", name: "Ethereum (ETH-EUR)", type: "crypto", exchange: null },
    { symbol: "4GLD.DE", name: "Xetra-Gold (4GLD)", type: "etf", exchange: "XETRA" },
];

export function AddAssetModal({
    existingSymbols,
    onClose,
    onAdded,
}: {
    existingSymbols: Set<string>;
    onClose: () => void;
    onAdded: () => void;
}) {
    const t = useT();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MarketSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const suggestions = SUGGESTIONS.filter((r) => !existingSymbols.has(r.symbol));
    const showSuggestions = query.trim().length < 2;
    const listed = showSuggestions ? suggestions : results;

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearching(false);
            setSearchError(false);
            return;
        }
        setSearching(true);
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/markets/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
                if (!res.ok) throw new Error("search failed");
                const data = (await res.json()) as { results?: MarketSearchResult[] };
                setResults(data.results ?? []);
                setSearchError(false);
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
                setResults([]);
                setSearchError(true);
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 350);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    async function handleAdd(result: MarketSearchResult) {
        if (addingSymbol) return;
        setAddingSymbol(result.symbol);
        setError(null);
        try {
            const res = await fetch("/api/markets/assets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: result.symbol, name: result.name, type: result.type }),
            });
            if (res.ok) {
                onAdded();
                return;
            }
            if (res.status === 409) setError(t("markets.alreadyAdded"));
            else if (res.status === 422) setError(t("markets.noData"));
            else if (res.status === 400) setError(t("markets.limitReached"));
            else setError(t("markets.addFailed"));
        } catch {
            setError(t("common.networkError"));
        } finally {
            setAddingSymbol(null);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t("markets.addAsset")}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[85vh] w-full max-w-md flex-col surface rounded-t-3xl p-6 shadow-xl sm:rounded-3xl"
            >
                <div className="mx-auto -mt-1 mb-4 h-1.5 w-10 shrink-0 rounded-full bg-muted/25 sm:hidden" />
                <div className="mb-3 flex shrink-0 items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">{t("markets.addAsset")}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="rounded-full p-2 text-muted transition-colors duration-150 hover:bg-chip hover:text-ink"
                    >
                        <IconClose className="h-5 w-5" />
                    </button>
                </div>

                <div className="relative shrink-0">
                    <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                    <input
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        maxLength={60}
                        placeholder={t("markets.searchPlaceholder")}
                        className={`${INPUT_CLS} pl-11`}
                    />
                </div>
                <p className="mt-2 shrink-0 text-xs text-muted">{t("markets.searchHint")}</p>

                {error && <p className="mt-3 shrink-0 text-sm font-semibold text-danger">{error}</p>}

                <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                    {searching && <p className="py-4 text-center text-sm text-muted">{t("markets.searching")}</p>}
                    {!searching && searchError && (
                        <p className="py-4 text-center text-sm text-muted">{t("markets.searchError")}</p>
                    )}
                    {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted">{t("markets.noResults")}</p>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                        <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            {t("markets.suggested")}
                        </p>
                    )}
                    {(showSuggestions || !searching) && listed.length > 0 && (
                        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                            {listed.map((r) => {
                                const already = existingSymbols.has(r.symbol);
                                return (
                                    <li key={r.symbol}>
                                        <button
                                            type="button"
                                            disabled={already || addingSymbol !== null}
                                            onClick={() => handleAdd(r)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-chip/60 disabled:opacity-50"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                                                <span className="block truncate text-xs text-muted">
                                                    {r.symbol} · {assetTypeLabel(t, r.type)}
                                                    {r.exchange ? ` · ${r.exchange}` : ""}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-xs font-bold text-brand">
                                                {already
                                                    ? t("markets.alreadyAdded")
                                                    : addingSymbol === r.symbol
                                                      ? t("common.saving")
                                                      : t("markets.add")}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
