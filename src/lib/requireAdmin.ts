import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/admin";
import { validateSession } from "@/lib/session";
import type { User } from "@/db/schema";

export async function requireAdmin(): Promise<User | NextResponse> {
    const user = await validateSession();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUsername(user.username)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return user;
}
