import { ca } from "./ca";
import { en } from "./en";
import { es } from "./es";
import type { Messages } from "./types";

export type Language = "en" | "es" | "ca";

export const LANGUAGES: Language[] = ["en", "es", "ca"];

export const LANGUAGE_OPTIONS: { key: Language; nativeName: string }[] = [
    { key: "en", nativeName: "English" },
    { key: "es", nativeName: "Español" },
    { key: "ca", nativeName: "Català" },
];

export const LANGUAGE_HTML: Record<Language, string> = {
    en: "en",
    es: "es",
    ca: "ca",
};

export const LANGUAGE_INTL: Record<Language, string> = {
    en: "en-GB",
    es: "es-ES",
    ca: "ca-ES",
};

const DICTIONARIES: Record<Language, Messages> = { en, es, ca };

export function isLanguage(value: unknown): value is Language {
    return value === "en" || value === "es" || value === "ca";
}

function pickLanguage(tags: string[]): Language {
    for (const raw of tags) {
        const tag = raw.trim().toLowerCase().split(";")[0];
        if (!tag) continue;
        if (tag === "ca" || tag.startsWith("ca-")) return "ca";
        if (tag === "es" || tag.startsWith("es-")) return "es";
        if (tag === "en" || tag.startsWith("en-")) return "en";
    }
    return "en";
}

export function languageFromAcceptLanguage(header: string | null | undefined): Language {
    if (!header) return "en";
    return pickLanguage(header.split(","));
}

export function detectBrowserLanguage(): Language {
    if (typeof navigator === "undefined") return "en";
    return pickLanguage([navigator.language, ...(navigator.languages ?? [])]);
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = {
    [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

function lookup(messages: Messages, key: string): string {
    const parts = key.split(".");
    let cur: unknown = messages;
    for (const part of parts) {
        if (!cur || typeof cur !== "object" || !(part in cur)) return key;
        cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : key;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        vars[name] === undefined ? `{${name}}` : String(vars[name]),
    );
}

export function translate(language: Language, key: MessageKey, vars?: Record<string, string | number>): string {
    return interpolate(lookup(DICTIONARIES[language], key), vars);
}

export function makeT(language: Language): TFunction {
    return (key, vars) => translate(language, key, vars);
}

export function formatMonthYear(monthKey: string, language: Language): string {
    const [y, m] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat(LANGUAGE_INTL[language], {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatShortMonthYear(monthKey: string, language: Language): string {
    const [y, m] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat(LANGUAGE_INTL[language], {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export { en, es, ca };
