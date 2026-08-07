import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users, account, category } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { eq } from "drizzle-orm";

const DEFAULT_ACCOUNTS = ["Main Bank", "Cash"];
const DEFAULT_INCOME_CATEGORIES: { name: string; icon: string | null }[] = [
    { name: "Salary", icon: "salary" },
    { name: "Investments", icon: "investments" },
    { name: "Other Income", icon: null },
];
const DEFAULT_EXPENSE_CATEGORIES: { name: string; icon: string | null }[] = [
    { name: "Food & Drinks", icon: "food" },
    { name: "Transport", icon: "transport" },
    { name: "Shopping", icon: "shopping" },
    { name: "Services", icon: "services" },
    { name: "Other Expense", icon: null },
];

export async function POST(request: Request) {
    try {
        const body = (await request.json().catch(() => null)) as {
            username?: unknown;
            password?: unknown;
            secretCode?: unknown;
        } | null;
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const secretCode = typeof body.secretCode === "string" ? body.secretCode : "";

        if (secretCode !== process.env.REGISTRATION_SECRET) {
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

        const accountsToInsert = DEFAULT_ACCOUNTS.map((accountName) => ({
            id: crypto.randomUUID(),
            userId,
            name: accountName,
        }));

        const categoriesToInsert = [
            ...DEFAULT_INCOME_CATEGORIES.map(({ name, icon }) => ({
                id: crypto.randomUUID(),
                userId,
                name,
                type: "income" as const,
                icon,
            })),
            ...DEFAULT_EXPENSE_CATEGORIES.map(({ name, icon }) => ({
                id: crypto.randomUUID(),
                userId,
                name,
                type: "expense" as const,
                icon,
            })),
        ];

        db.transaction((tx) => {
            tx.insert(users)
                .values({
                    id: userId,
                    username,
                    passwordHash,
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