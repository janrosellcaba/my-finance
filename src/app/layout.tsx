import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { validateSession } from "@/lib/session";
import { isLanguage, LANGUAGE_HTML, languageFromAcceptLanguage } from "@/i18n";
import { DEFAULT_APPEARANCE } from "./shared";

const outfit = Outfit({
	variable: "--font-outfit",
	subsets: ["latin"],
	weight: ["500", "600", "700", "800"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "MyFinance",
	description: "Track your income, expenses, and transfers",
	manifest: "/manifest.json",
	icons: {
		icon: "/favicon.ico",
		apple: "/apple-touch-icon.png",
	},
	appleWebApp: {
		capable: true,
		title: "MyFinance",
		statusBarStyle: "default",
	},
};

export async function generateViewport(): Promise<Viewport> {
	const user = await validateSession();
	return { themeColor: user?.themePreference === "dark" ? "#1b1a17" : "#faf8f2" };
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await validateSession();
	const theme = user?.themePreference ?? DEFAULT_APPEARANCE.theme;
	const accent = user?.accentColor ?? DEFAULT_APPEARANCE.accent;
	const language = isLanguage(user?.language)
		? user.language
		: languageFromAcceptLanguage((await headers()).get("accept-language"));

	return (
		<html lang={LANGUAGE_HTML[language]} data-theme={theme} data-accent={accent}>
			<body className={`${outfit.variable} antialiased`}>
				{children}
				<ServiceWorkerRegister />
			</body>
		</html>
	);
}
