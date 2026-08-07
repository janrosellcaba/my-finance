# Feature plan

Working checklist for the next batch of improvements. Tick off `- [ ]` → `- [x]` as each one ships and is deployed to `ion`. Order below is suggested (roughly: contained wins first, schema changes next, infra/investigation-dependent last) — reorder freely.

---

## 1. Transaction filters: date range, account, type

- [ ] Not started

**Goal:** `TransactionsView` already has search + category filter + cursor pagination. Add date range, account, and type (income/expense/transfer) as siblings.

**Files:**
- `src/app/api/transactions/route.ts` — GET handler (~line 174), extend the `and(...)` where clause with optional `dateFrom`/`dateTo`/`accountId`/`type` query params, same pattern as the existing `search`/`category` params.
- `src/app/components/TransactionsView.tsx` — new filter state + UI controls inside the existing `showFilters` panel (date inputs, account pills, type pills), mirroring the category-filter pills already there.

**Notes:** No schema change. Self-contained.

---

## 2. Category icons

- [ ] Not started

**Goal:** Icon in addition to color per category (income/expense), shown on `TransactionCard` and in category config.

**Files:**
- `src/db/schema.ts` — add `icon: text("icon")` to `category` (nullable, like `color`). Needs `db:generate` + a reviewed migration.
- `src/app/shared.ts` — extend the `Category` type with `icon: string | null`; add a curated icon-name palette (small fixed set, like `CATEGORY_COLOR_PALETTE`).
- `src/app/components/icons.tsx` — likely needs a handful of new icons (food, transport, home, etc.) beyond the current UI-chrome set.
- `SortableCategoryRow.tsx` / `CategoryList.tsx` — icon picker next to the existing color picker.
- `TransactionCard.tsx` — render the icon.
- `src/app/api/config/route.ts` — new `set-icon` PATCH action, mirroring `set-color`.

**Notes:** Needs a schema migration — plan this one for a clean `deploy.sh` run (see the recent incident with `is_default`). Biggest lift on this list after the PWA item.

---

## 3. Net worth over time, per account

- [ ] Not started

**Goal:** `NetWorthChart` (`src/app/components/analytics/panels.tsx:75`) currently renders one aggregate series (`data.netWorth.series`). Add a per-account breakdown.

**Files:**
- `src/lib/analytics.ts` — `buildAnalytics()` needs a new per-account series alongside the aggregate one. Check how `dashboard/route.ts` computes per-account balances (`applyTransactionToBalances`) and reuse/adapt that logic across the period's date range instead of just "now."
- `src/app/components/analytics/panels.tsx` — `NetWorthChart` needs either a stacked/multi-line chart or an account toggle.

**Notes:** No schema change, but the analytics-engine change is the real work here — the panel itself is a small addition once the data exists. Read `analytics.ts`'s existing net-worth computation fully before starting; don't guess at the shape.

---

## 4. MoversPanel drill-down

- [ ] Not started

**Goal:** Tapping a mover in `MoversPanel` (`panels.tsx:277`, has `m.categoryId`) shows the actual transactions behind that change for the selected period.

**Files:**
- `src/app/components/analytics/panels.tsx` — `MoversPanel` gets an `onSelectCategory` callback, make each row a button.
- `src/app/components/AnalyticsView.tsx` — owns period state already; add a drill-down modal/panel that fetches (or filters already-loaded) transactions for `categoryId` within the current period.

**Notes:** No schema change. Straightforward once the click-target plumbing is in place.

---

## 5. Rate-limit login attempts

- [ ] Not started

**Goal:** Lock out after N failed attempts (e.g. 5) for a window, per username or IP.

**Files:**
- New `src/lib/rateLimit.ts` — in-memory `Map` keyed by username (or IP from request headers), tracking failure count + window start. In-memory is fine: single Node process on `ion`, resets on restart are an acceptable tradeoff (a restart is already a rare, deliberate event via `deploy.sh`).
- `src/app/api/auth/login/route.ts` — check/increment on failure, reset on success, return a clear "too many attempts, try again in X" error.

**Notes:** No schema change, no new dependency. Small and contained.

---

## 6. "Download backup now" button

- [ ] Not started

**Goal:** A button in `ConfigView` that triggers an on-demand snapshot and returns it as a download, independent of the nightly cron.

**Files:**
- New `src/app/api/backup/route.ts` (GET, session-gated) — `better-sqlite3` has a native `.backup()` method (no need to shell out to the `sqlite3` CLI like `deploy.sh` does); stream the resulting file back with `Content-Disposition: attachment`.
- `src/app/components/ConfigView.tsx` — a "Download Backup Now" button, probably in the existing "Danger"/settings area or a new small section.

**Notes:** No schema change. Reuses the same WAL-safe backup principle already verified in `deploy.sh` (§ backup fix from the recent incident), just via the driver's own API instead of the CLI.

---

## 7. Alert if the nightly backup fails

- [ ] Not started — **needs input from you first**

**Goal:** Get notified (email or webhook) if the server-side nightly backup cron fails silently.

**Blocked on:** I don't have visibility into the actual nightly backup script/cron on `ion` — this lives outside the repo. Before this can be planned properly I need:
- The current cron entry (`crontab -l` on `ion`) or the backup script itself, if one already exists.
- Which notification channel you want (email needs an SMTP relay or a service like Resend/Postmark; a webhook to something like ntfy.sh or Healthchecks.io's dead-man's-switch pattern is much less infrastructure for a one-person app).

**Notes:** Not app code — this is VPS/infra config, not a `src/` change. Recommend a "dead man's switch" pattern (Healthchecks.io free tier or self-hosted equivalent): the cron pings a URL on success, and the external service alerts you if it *doesn't* hear from you on schedule. That catches "the cron didn't run at all" too, which a simple try/catch-and-email inside the script can't.

---

## 8. PWA: manifest.json + service worker

- [ ] Not started

**Goal:** Installable to the home screen.

**Files:**
- `public/manifest.json` — name, icons, `display: "standalone"`, theme colors (already have `--color-cream` etc. in `globals.css` to match).
- Icons at required sizes (192×192, 512×512 minimum) — only have `public/logo.png` at one size currently; needs resizing/generating variants.
- `src/app/layout.tsx` — link the manifest, add `apple-mobile-web-app` meta tags alongside the existing `metadata`/`viewport` exports.
- `public/sw.js` + a small registration script — minimal service worker. Decide scope up front: just enabling installability (near-zero risk), or also offline caching (real risk of serving stale API data for a finance app — needs careful cache strategy, e.g. network-first for all `/api/*`).

**Notes:** No schema change. Biggest lift on this list — most of it is asset/config work, not logic, but service worker caching bugs are the classic way PWAs silently show stale data, so keep the caching strategy deliberately minimal at first.

---

## Suggested order

1. Transaction filters (#1) — fully contained, immediate value
2. MoversPanel drill-down (#4) — fully contained
3. Rate-limit login (#5) — fully contained, security-relevant
4. Download backup button (#6) — fully contained, directly related to the recent data-safety work
5. Net worth per account (#3) — needs reading `analytics.ts` first, no schema change
6. Category icons (#2) — first one needing a migration; do it once, deliberately, on a clean `deploy.sh` run
7. PWA (#8) — bigger, mostly asset/config work
8. Backup failure alert (#7) — pick this up once you've shared the current cron setup
