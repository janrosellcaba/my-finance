import { NextResponse } from "next/server";
import { invalidateSession } from "@/lib/session";

export async function POST() {
    try {
        await invalidateSession();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Logout error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}