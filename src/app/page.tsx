import { validateSession } from "@/lib/session";
import { AuthGate } from "./components/AuthGate";
import { AppShell } from "./components/AppShell";

export default async function Home() {
    const user = await validateSession();

    if (!user) {
        return <AuthGate />;
    }

    return <AppShell username={user.username} initialPrivacyMode={user.privacyMode} initialTheme={user.themePreference} />;
}
