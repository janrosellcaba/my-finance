import { validateSession } from "@/lib/session";
import { AuthGate, AppShell } from "./FinanceApp";

export default async function Home() {
    const user = await validateSession();

    if (!user) {
        return <AuthGate />;
    }

    return <AppShell username={user.username} />;
}
