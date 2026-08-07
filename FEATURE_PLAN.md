# Feature plan

Working checklist for the next batch of improvements. Tick off `- [ ]` → `- [x]` as each one ships and is deployed to `ion`.

**Order:** importance + complexity first, so the substantial work gets done while it's front of mind. The backup-failure alert (#8) is deliberately last — it may need real infra (SMTP relay, webhook service) rather than just app code, so it's parked until the simpler items are done and, if it does turn out to need heavy setup, it can slip without blocking anything else.

---

## 1. Rate-limit login attempts

- [x] Done — `src/lib/rateLimit.ts` + `src/app/api/auth/login/route.ts`, verified live: 5 failed attempts lock the account for 15 minutes (429, even with the correct password), other usernames stay unaffected, and a successful login clears the counter.

**Goal:** Lock out after N failed attempts (e.g. 5) for a window, per username or IP.

**Files:**
- New `src/lib/rateLimit.ts` — in-memory `Map` keyed by username (or IP from request headers), tracking failure count + window start. In-memory is fine: single Node process on `ion`, resets on restart are an acceptable tradeoff (a restart is already a rare, deliberate event via `deploy.sh`).
- `src/app/api/auth/login/route.ts` — check/increment on failure, reset on success, return a clear "too many attempts, try again in X" error.

**Notes:** No schema change, no new dependency. Security-relevant — this is the app's only auth gate besides the registration secret.

---

## 2. "Download backup now" button

- [x] Done — `src/app/api/backup/route.ts` (uses `db.$client.serialize()`, no temp file needed) + a new "Backup" section in `ConfigView.tsx`. Verified live: downloaded file passes `PRAGMA integrity_check`, contains a real canary transaction, all tables present; unauthenticated requests get 401.

**Goal:** A button in `ConfigView` that triggers an on-demand snapshot and returns it as a download, independent of the nightly cron.

**Files:**
- New `src/app/api/backup/route.ts` (GET, session-gated) — `better-sqlite3` has a native `.backup()` method (no need to shell out to the `sqlite3` CLI like `deploy.sh` does); stream the resulting file back with `Content-Disposition: attachment`.
- `src/app/components/ConfigView.tsx` — a "Download Backup Now" button, probably in the existing "Danger"/settings area or a new small section.

**Notes:** No schema change. Reuses the same WAL-safe backup principle already verified in `deploy.sh` (the backup fix from the recent incident), just via the driver's own API instead of the CLI. Directly related to the data-safety work already done — high value for the effort.

---

## 3. Net worth over time, per account

- [x] Done — `src/lib/analytics.ts` (`netWorthByAccount`, reuses `applyTransactionToBalances` so transfers move money between accounts correctly while leaving the aggregate untouched) + an account-selector toggle in `NetWorthChart` (`panels.tsx`). Verified with a standalone math check (transfer moves exactly the right amount between two accounts, aggregate provably unchanged) and live through the real `/api/analytics` route with a real income + transfer.

**Goal:** `NetWorthChart` (`src/app/components/analytics/panels.tsx:75`) currently renders one aggregate series (`data.netWorth.series`). Add a per-account breakdown.

**Files:**
- `src/lib/analytics.ts` — `buildAnalytics()` needs a new per-account series alongside the aggregate one. Check how `dashboard/route.ts` computes per-account balances (`applyTransactionToBalances`) and reuse/adapt that logic across the period's date range instead of just "now."
- `src/app/components/analytics/panels.tsx` — `NetWorthChart` needs either a stacked/multi-line chart or an account toggle.

**Notes:** No schema change, but the analytics-engine change is real work — the panel itself is a small addition once the data exists. Read `analytics.ts`'s existing net-worth computation fully before starting; don't guess at the shape.

---

## 4. Category icons

- [x] Done — `category.icon` (nullable, migration `0008_organic_impossible_man.sql`), 12-icon curated set in `icons.tsx`, icon picker in `SortableCategoryRow`/`CategoryList`, `set-icon` PATCH action, icon badge on `TransactionCard`, and matching icons auto-assigned to the signup-seeded categories (Salary, Investments, Food & Drinks, Transport, Shopping, Services). Verified live: seed icons correct, set/validate/clear all work, invalid icon key rejected with 400, wrong-owner id rejected with 404, and a real transaction's `destinationId` correctly resolves to an icon-tagged category.

**Goal:** Icon in addition to color per category (income/expense), shown on `TransactionCard` and in category config.

**Files:**
- `src/db/schema.ts` — add `icon: text("icon")` to `category` (nullable, like `color`). Needs `db:generate` + a reviewed migration.
- `src/app/shared.ts` — extend the `Category` type with `icon: string | null`; add a curated icon-name palette (small fixed set, like `CATEGORY_COLOR_PALETTE`).
- `src/app/components/icons.tsx` — likely needs a handful of new icons (food, transport, home, etc.) beyond the current UI-chrome set.
- `SortableCategoryRow.tsx` / `CategoryList.tsx` — icon picker next to the existing color picker.
- `TransactionCard.tsx` — render the icon.
- `src/app/api/config/route.ts` — new `set-icon` PATCH action, mirroring `set-color`.

**Notes:** Needs a schema migration — do this one deliberately, on its own clean `deploy.sh` run (see the recent incident with `is_default`), not bundled with something else.

---

## 5. PWA: manifest.json + service worker

- [x] Done — `public/manifest.json`, icons generated from `logo.png` (192, 512, apple-touch 180), linked via `layout.tsx`'s `metadata.manifest`/`appleWebApp`, `public/sw.js` registered by `ServiceWorkerRegister.tsx`. Deliberately network-only (no caching at all) to avoid any risk of showing stale financial data. Also removed `public/_headers`, a dead Cloudflare Pages config file that nginx never read and Next was serving verbatim at `/_headers`. Verified live: manifest/sw/icons all serve with correct content-types, HTML correctly links them, `/_headers` now 404s, `sw.js` is valid JS.

**Goal:** Installable to the home screen.

**Files:**
- `public/manifest.json` — name, icons, `display: "standalone"`, theme colors (already have `--color-cream` etc. in `globals.css` to match).
- Icons at required sizes (192×192, 512×512 minimum) — only have `public/logo.png` at one size currently; needs resizing/generating variants.
- `src/app/layout.tsx` — link the manifest, add `apple-mobile-web-app` meta tags alongside the existing `metadata`/`viewport` exports.
- `public/sw.js` + a small registration script — minimal service worker. Decide scope up front: just enabling installability (near-zero risk), or also offline caching (real risk of serving stale API data for a finance app — needs careful cache strategy, e.g. network-first for all `/api/*`).

**Notes:** No schema change. Biggest lift on this list — most of it is asset/config work, not logic, but service worker caching bugs are the classic way PWAs silently show stale data, so keep the caching strategy deliberately minimal at first.

---

## 6. Transaction filters: date range, account, type

- [x] Done — API already had `startDate`/`endDate`, just unused by the UI; added new `account` (matches either side of a transfer) and `type` filters to `src/app/api/transactions/route.ts`, plus type pills, account pills, and date-range inputs in `TransactionsView.tsx`'s filter panel. Verified live with 4 transactions spanning 2 accounts/3 types/3 months: every filter and every combination (including account+type together) returned exactly the expected rows; invalid `type` rejected with 400.

**Goal:** `TransactionsView` already has search + category filter + cursor pagination. Add date range, account, and type (income/expense/transfer) as siblings.

**Files:**
- `src/app/api/transactions/route.ts` — GET handler (~line 174), extend the `and(...)` where clause with optional `dateFrom`/`dateTo`/`accountId`/`type` query params, same pattern as the existing `search`/`category` params.
- `src/app/components/TransactionsView.tsx` — new filter state + UI controls inside the existing `showFilters` panel (date inputs, account pills, type pills), mirroring the category-filter pills already there.

**Notes:** No schema change. Self-contained — lower priority than the above since it's a quality-of-life improvement, not a gap in safety or insight.

---

## 7. MoversPanel drill-down

- [x] Done — entirely self-contained in `panels.tsx` (no need to thread props through `AdvancedDashboard`/`AnalyticsView` after all, since `data.period.start`/`.end` were already available on the same `data` object `MoversPanel` receives). Each mover row is now a button opening a modal that fetches `/api/transactions?category=X&startDate=...&endDate=...` for that exact period. Verified live with a real baseline (3 months steady spending) + a real spike: the analytics engine's computed `absChange` matched exactly, and each category's drill-down returned only its own period transactions -- no cross-category or cross-period leakage.

**Goal:** Tapping a mover in `MoversPanel` (`panels.tsx:277`, has `m.categoryId`) shows the actual transactions behind that change for the selected period.

**Files:**
- `src/app/components/analytics/panels.tsx` — `MoversPanel` gets an `onSelectCategory` callback, make each row a button.
- `src/app/components/AnalyticsView.tsx` — owns period state already; add a drill-down modal/panel that fetches (or filters already-loaded) transactions for `categoryId` within the current period.

**Notes:** No schema change. Straightforward once the click-target plumbing is in place — smallest item on the list, parked here mainly because it's the least urgent.

---

## 8. Alert if the nightly backup fails

- [ ] Not started — **needs input from you first**

**Goal:** Get notified (email or webhook) if the server-side nightly backup cron fails silently.

**Blocked on:** I don't have visibility into the actual nightly backup script/cron on `ion` — this lives outside the repo. Before this can be planned properly I need:
- The current cron entry (`crontab -l` on `ion`) or the backup script itself, if one already exists.
- Which notification channel you want.

**Notes:** Not app code — this is VPS/infra config, not a `src/` change. If a full email setup (SMTP relay, deliverability, etc.) turns out to be too much for what it's worth, the pragmatic alternative is a "dead man's switch" webhook (Healthchecks.io free tier or self-hosted equivalent): the cron pings a URL on success, and the external service alerts you if it *doesn't* hear from you on schedule — one `curl` line in the cron script, no mail server. That also catches "the cron didn't run at all," which a try/catch-and-email inside the script can't. Deliberately last on this list; fine for it to slip if it gets complicated.
