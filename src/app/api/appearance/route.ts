import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { validateSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import {
    ACCENT_COLORS,
    CURRENCY_OPTIONS,
    DATE_FORMAT_OPTIONS,
    type AccentColor,
    type CurrencyCode,
    type DateFormat,
    type Theme,
} from "@/app/shared";

const ACCENTS = new Set(ACCENT_COLORS.map((c) => c.key));
const CURRENCIES = new Set(CURRENCY_OPTIONS.map((c) => c.key));
const DATE_FORMATS = new Set(DATE_FORMAT_OPTIONS.map((d) => d.key));

type AppearanceBody = {
    theme?: unknown;
    privacyMode?: unknown;
    accent?: unknown;
    currency?: unknown;
    dateFormat?: unknown;
};

export async function PATCH(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as AppearanceBody | null;
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid body." }, { status: 400 });
        }

        const patch: {
            themePreference?: Theme;
            privacyMode?: boolean;
            accentColor?: AccentColor;
            currency?: CurrencyCode;
            dateFormat?: DateFormat;
        } = {};

        if ("theme" in body) {
            if (body.theme !== "light" && body.theme !== "dark") {
                return NextResponse.json({ error: "theme must be 'light' or 'dark'." }, { status: 400 });
            }
            patch.themePreference = body.theme;
        }
        if ("privacyMode" in body) {
            if (typeof body.privacyMode !== "boolean") {
                return NextResponse.json({ error: "privacyMode must be a boolean." }, { status: 400 });
            }
            patch.privacyMode = body.privacyMode;
        }
        if ("accent" in body) {
            if (typeof body.accent !== "string" || !ACCENTS.has(body.accent as AccentColor)) {
                return NextResponse.json({ error: "Invalid accent." }, { status: 400 });
            }
            patch.accentColor = body.accent as AccentColor;
        }
        if ("currency" in body) {
            if (typeof body.currency !== "string" || !CURRENCIES.has(body.currency as CurrencyCode)) {
                return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
            }
            patch.currency = body.currency as CurrencyCode;
        }
        if ("dateFormat" in body) {
            if (typeof body.dateFormat !== "string" || !DATE_FORMATS.has(body.dateFormat as DateFormat)) {
                return NextResponse.json({ error: "Invalid dateFormat." }, { status: 400 });
            }
            patch.dateFormat = body.dateFormat as DateFormat;
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "No appearance fields to update." }, { status: 400 });
        }

        const db = await getDb();
        await db.update(users).set(patch).where(eq(users.id, user.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Appearance update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
