"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type Language, type TFunction } from "./index";

const I18nContext = createContext<{ language: Language; t: TFunction } | null>(null);

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
    const value = useMemo(() => ({ language, t: makeT(language) }), [language]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error("useI18n must be used within I18nProvider");
    return ctx;
}

export function useT(): TFunction {
    return useI18n().t;
}

export function useLanguage(): Language {
    return useI18n().language;
}
