import { NextResponse } from "next/server";
import { Resend } from "resend";
import { validateSession } from "@/lib/session";
import { isRateLimited, recordFailure } from "@/lib/rateLimit";
import { SUPPORT_TOPICS, type SupportTopic } from "@/app/shared";

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatRetryAfter(ms: number): string {
    const minutes = Math.ceil(ms / 60_000);
    return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
}

function isSupportTopic(value: string): value is SupportTopic {
    return (SUPPORT_TOPICS as readonly string[]).includes(value);
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
    try {
        const user = await validateSession();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rateLimitKey = `contact:${user.id}`;
        const { limited, retryAfterMs } = isRateLimited(rateLimitKey);
        if (limited) {
            return NextResponse.json(
                { error: `Too many messages. Try again in ${formatRetryAfter(retryAfterMs)}.` },
                { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
            );
        }

        const apiKey = process.env.RESEND_API_KEY?.trim();
        const toEmail = process.env.CONTACT_EMAIL?.trim() || "jan@janrosell.com";
        const fromEmail = process.env.RESEND_FROM?.trim() || "onboarding@resend.dev";

        if (!apiKey) {
            return NextResponse.json({ error: "Email service not configured." }, { status: 500 });
        }

        const body = (await request.json().catch(() => null)) as {
            email?: unknown;
            topic?: unknown;
            message?: unknown;
        } | null;

        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const email = typeof body.email === "string" ? body.email.trim() : "";
        const topic = typeof body.topic === "string" ? body.topic.trim() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";

        if (!email || !topic || !message) {
            return NextResponse.json({ error: "Email, topic, and message are required." }, { status: 400 });
        }

        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        }

        if (!isSupportTopic(topic)) {
            return NextResponse.json({ error: "Please choose a valid topic." }, { status: 400 });
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` },
                { status: 400 }
            );
        }

        const resend = new Resend(apiKey);
        const safeUsername = escapeHtml(user.username);
        const safeEmail = escapeHtml(email);
        const safeTopic = escapeHtml(topic);
        const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

        const { error } = await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            replyTo: email,
            subject: `[MyFinance] ${topic} from ${user.username}`,
            text: `From: ${user.username} <${email}>\nTopic: ${topic}\n\n${message}`,
            html: `
                <p style="font-size:18px;margin:0 0 16px;">
                    <strong>Reply to:</strong>
                    <a href="mailto:${safeEmail}">${safeEmail}</a>
                </p>
                <p style="margin:0 0 8px;"><strong>Username:</strong> ${safeUsername}</p>
                <p style="margin:0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
                <p style="margin:0 0 16px;"><strong>Topic:</strong> ${safeTopic}</p>
                <p style="margin:0 0 8px;"><strong>Message:</strong></p>
                <p style="margin:0;">${safeMessage}</p>
            `,
        });

        if (error) {
            console.error("Resend error:", error);
            return NextResponse.json(
                { error: "Failed to send message. Please try again later." },
                { status: 500 }
            );
        }

        recordFailure(rateLimitKey);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Contact error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
