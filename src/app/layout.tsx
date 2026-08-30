import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope, Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { validateSession } from "@/lib/session";
import { DEFAULT_APPEARANCE } from "./shared";

const outfit = Outfit({
	variable: "--font-outfit",
	subsets: ["latin"],
	weight: ["500", "600", "700", "800"],
	display: "swap",
});

const dmSans = DM_Sans({
	variable: "--font-dm-sans",
	subsets: ["latin"],
	weight: ["500", "600", "700"],
	display: "swap",
});

const manrope = Manrope({
	variable: "--font-manrope",
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
	const density = user?.density ?? DEFAULT_APPEARANCE.density;
	const font = user?.fontPreference ?? DEFAULT_APPEARANCE.font;

	return (
		<html
			lang="en-GB"
			data-theme={theme}
			data-accent={accent}
			data-density={density}
			data-font={font}
		>
			<body className={`${outfit.variable} ${dmSans.variable} ${manrope.variable} antialiased`}>
				{children}
				<ServiceWorkerRegister />
			</body>
		</html>
	);
}
