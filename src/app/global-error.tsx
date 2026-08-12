"use client";

import { useEffect } from "react";

const RELOAD_KEY = "myfinance-last-stale-action-reload";
const MIN_RELOAD_INTERVAL_MS = 10_000;

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	useEffect(() => {
		if (!error.message.includes("Failed to find Server Action")) return;

		// A stale action means this tab is running JS from a previous deploy (e.g. an
		// installed PWA resumed from the background days later). Reload to fetch the
		// current bundle. Throttled so a genuinely broken reload (e.g. offline) can't
		// loop forever, while a later stale-action hit still gets its own reload.
		const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
		if (Date.now() - lastReload < MIN_RELOAD_INTERVAL_MS) return;

		sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
		window.location.reload();
	}, [error]);

	return (
		<html lang="en-GB">
			<body style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
				<p>Updating the app…</p>
			</body>
		</html>
	);
}
