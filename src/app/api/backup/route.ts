import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { validateSession } from "@/lib/session";

export async function GET() {
    const user = await validateSession();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const buffer = db.$client.serialize();
    const filename = `myfinance-backup-${new Date().toISOString().slice(0, 10)}.db`;

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(buffer.length),
        },
    });
}
