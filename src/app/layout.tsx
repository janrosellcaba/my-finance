import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { validateSession } from "@/lib/session";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const outfit = Outfit({
	variable: "--font-outfit",
	subsets: ["latin"],
	weight: ["500", "600", "700", "800"],
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
	const theme = user?.themePreference ?? "light";

	return (
		<html lang="en" data-theme={theme}>
			<body className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}>
				{children}
				<ServiceWorkerRegister />
			</body>
		</html>
	);
}
