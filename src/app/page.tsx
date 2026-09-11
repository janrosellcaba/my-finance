import { headers } from "next/headers";
import { validateSession } from "@/lib/session";
import { isLanguage, languageFromAcceptLanguage } from "@/i18n";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthGate } from "./components/AuthGate";
import { AppShell } from "./components/AppShell";
import { DEFAULT_APPEARANCE, type AppearancePrefs } from "./shared";

export default async function Home() {
    const user = await validateSession();
    const headerLanguage = languageFromAcceptLanguage((await headers()).get("accept-language"));

    if (!user) {
        return (
            <I18nProvider language={headerLanguage}>
                <AuthGate />
            </I18nProvider>
        );
    }

    const storedLanguage = isLanguage(user.language) ? user.language : null;
    const initialAppearance: AppearancePrefs = {
        theme: user.themePreference ?? DEFAULT_APPEARANCE.theme,
        privacyMode: user.privacyMode ?? DEFAULT_APPEARANCE.privacyMode,
        accent: user.accentColor ?? DEFAULT_APPEARANCE.accent,
        currency: user.currency ?? DEFAULT_APPEARANCE.currency,
        dateFormat: user.dateFormat ?? DEFAULT_APPEARANCE.dateFormat,
        language: storedLanguage ?? headerLanguage,
    };

    return (
        <I18nProvider language={initialAppearance.language}>
            <AppShell
                username={user.username}
                initialAppearance={initialAppearance}
                accountCreatedAt={user.createdAt}
                persistLanguage={!storedLanguage}
            />
        </I18nProvider>
    );
}
