import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";

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

export const viewport: Viewport = {
	themeColor: "#faf8f2",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}>
				{children}
				<ServiceWorkerRegister />
			</body>
		</html>
	);
}
