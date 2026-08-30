import { validateSession } from "@/lib/session";
import { AuthGate } from "./components/AuthGate";
import { AppShell } from "./components/AppShell";
import { DEFAULT_APPEARANCE, type AppearancePrefs } from "./shared";

export default async function Home() {
    const user = await validateSession();

    if (!user) {
        return <AuthGate />;
    }

    const initialAppearance: AppearancePrefs = {
        theme: user.themePreference ?? DEFAULT_APPEARANCE.theme,
        privacyMode: user.privacyMode ?? DEFAULT_APPEARANCE.privacyMode,
        accent: user.accentColor ?? DEFAULT_APPEARANCE.accent,
        density: user.density ?? DEFAULT_APPEARANCE.density,
        font: user.fontPreference ?? DEFAULT_APPEARANCE.font,
        currency: user.currency ?? DEFAULT_APPEARANCE.currency,
        dateFormat: user.dateFormat ?? DEFAULT_APPEARANCE.dateFormat,
    };

    return <AppShell username={user.username} initialAppearance={initialAppearance} />;
}
