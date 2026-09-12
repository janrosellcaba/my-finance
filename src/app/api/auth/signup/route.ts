import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users, account, category } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { eq } from "drizzle-orm";
import { isLanguage, languageFromAcceptLanguage, makeT } from "@/i18n";

export async function POST(request: Request) {
    try {
        const body = (await request.json().catch(() => null)) as {
            username?: unknown;
            password?: unknown;
            secretCode?: unknown;
            language?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const secretCode = typeof body.secretCode === "string" ? body.secretCode : "";
        const expectedSecret = process.env.REGISTRATION_SECRET;

        if (!expectedSecret || secretCode !== expectedSecret) {
            return NextResponse.json({ error: "Unauthorized: Invalid registration safety code." }, { status: 403 });
        }

        if (username.length < 3 || password.length < 1) {
            return NextResponse.json(
                { error: "Username must be at least 3 characters and password at least 1 character." },
                { status: 400 }
            );
        }

        const db = await getDb();

        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .get();

        if (existingUser) {
            return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
        }

        const passwordHash = await hashPassword(password);
        const userId = crypto.randomUUID();
        const language = isLanguage(body.language)
            ? body.language
            : languageFromAcceptLanguage((await headers()).get("accept-language"));
        const t = makeT(language);

        const accountsToInsert = [t("seeds.mainBank"), t("seeds.cash")].map((accountName) => ({
            id: crypto.randomUUID(),
            userId,
            name: accountName,
        }));

        const categoriesToInsert = [
            { name: t("seeds.salary"), icon: "salary" as string | null, type: "income" as const },
            { name: t("seeds.investments"), icon: "investments", type: "income" as const },
            { name: t("seeds.otherIncome"), icon: null, type: "income" as const },
            { name: t("seeds.food"), icon: "food", type: "expense" as const },
            { name: t("seeds.transport"), icon: "transport", type: "expense" as const },
            { name: t("seeds.shopping"), icon: "shopping", type: "expense" as const },
            { name: t("seeds.services"), icon: "services", type: "expense" as const },
            { name: t("seeds.otherExpense"), icon: null, type: "expense" as const },
        ].map(({ name, icon, type }) => ({
            id: crypto.randomUUID(),
            userId,
            name,
            type,
            icon,
        }));

        db.transaction((tx) => {
            tx.insert(users)
                .values({
                    id: userId,
                    username,
                    passwordHash,
                    language,
                    lastSeenAt: new Date().toISOString(),
                })
                .run();
            tx.insert(account).values(accountsToInsert).run();
            tx.insert(category).values(categoriesToInsert).run();
        });

        const { token, expiresAt } = await createSession(userId);

        await setSessionCookie(token, expiresAt);

        return NextResponse.json({ success: true, userId }, { status: 201 });
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}