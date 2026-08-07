improve transactions page
better session control -> auth api calls
add a todo list

footer sometimes disappears
when delete all transactions, update home page


add onboarding

---done---
when add transactions have a default bank that appears first
toast/undo on delete (transaction, todo, category)
view password
export transaction data
import transaction data
admin
add button to hide numbers (save in user db)
analytics
change icons
analytics by default on current month
if change cat name, it chganges everywhere!
cat colours








Went through your schema, routes, and toDo.md to ground this in what's actually there rather than generic finance-app filler. A few observations first: your transactions list already has search + category filter + cursor pagination, but no date-range, account, type, or amount filtering — that's a concrete gap. And analytics.ts already detects recurring spending patterns, but nothing lets you schedule a recurring transaction (e.g. rent) so it auto-creates — those are different features that'd pair well.

Here's a categorized set, roughly small → large:

Tiny details

Show/hide password toggle on login/signup (you already have PasswordInput.tsx — check if the eye icon is there; if not, it's a 10-minute add)
Toast/undo on delete (transaction, todo, category) instead of instant silent removal — "Deleted. Undo?" for 5s
Keyboard shortcuts: / to focus search, n for new transaction, Esc to close modals
Sticky date headers when scrolling the transactions list (group by day/month)
Empty states with a nudge ("No transactions yet — import a CSV or add one")
Copy last transaction's category/account when adding a new one (speeds up repeat entries)
Transactions page (your own toDo.md flags this as unfinished)

Filter by date range, account, and type (income/expense/transfer) — the API already takes search/categoryFilter, adding siblings is straightforward
Sort toggle (date vs amount)
Bulk actions: select multiple rows → bulk delete or bulk recategorize
Split transactions (one purchase, multiple categories) — bigger schema change, so only if it comes up often in real usage
Recurring & automation

Recurring transaction templates ("Rent, €800, 1st of month, Main Bank → Housing") that auto-insert on schedule — natural extension of RecurringPanel's detection logic, but as a scheduler instead of a report
"Convert to recurring" button directly from an existing transaction row
Accounts & categories

Archive instead of delete for accounts/categories with transaction history (soft delete — isArchived flag) so old data isn't orphaned when a bank account closes
Category icons in addition to colors (small polish, icons.tsx already exists as an icon set)
Net worth over time per account, not just aggregate (you already compute per-account balances in dashboard)
Analytics extensions (building on the Phase B engine you already shipped)

Savings goals — not budgets (I know that was explicitly ruled out for Phase B) — a goal is "save €5k by December" with progress, no spending limit implied
Year-over-year comparison view (this month vs same month last year)
"Biggest changes since last month" already exists as MoversPanel — could add a per-category drill-down when you tap it
Security & account

Rate-limit login attempts (you have session.ts already managing sessions — bolt-on lockout after N failures)
Optional 2FA (TOTP) — bigger lift, only worth it if this is reachable beyond just you
"Log out all other sessions" button (you already invalidate all sessions on password change/danger actions — surface it as a standalone action)
Data safety (you mentioned /backups/ on the VPS)

A "download backup now" button in the app that triggers the same snapshot logic, so you're not solely reliant on the server-side cron
Scheduled email/webhook alert if the nightly backup script fails (silent backup failure is the classic way people lose everything)
Mobile/PWA

Add a manifest.json + service worker so it can be "installed" to the home screen (you already have logo.png/favicon — most of the asset work is done)
Swipe-to-delete on transaction cards (mobile-first gesture, fits BottomNav/mobile-tab patterns you already use elsewhere)
Want me to dig into any one of these further, or just pick a few and start?