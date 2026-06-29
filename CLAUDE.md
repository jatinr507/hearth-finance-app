# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build locally
npx tsc --noEmit  # Type-check without building
```

## Environment Setup

Copy `.env.example` to `.env` and fill in your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run `supabase/schema.sql` in the Supabase SQL editor to create tables, RLS policies, and seed default categories. For an existing project, apply `supabase/migrations/0002_plaid.sql` to add Plaid support.

Enable Google OAuth in Supabase Dashboard → Authentication → Providers → Google.

**Plaid Edge Functions** (bank sync): set server-only secrets (never `VITE_`-prefixed, never in the browser bundle) — see `supabase/functions/.env.example`:
```
supabase secrets set PLAID_CLIENT_ID=… PLAID_SECRET=… PLAID_ENV=sandbox
supabase functions deploy plaid-link-token plaid-exchange plaid-sync plaid-items plaid-remove
```

## Architecture

**Stack:** React 19 + TypeScript, Vite, Tailwind CSS v4, Supabase (auth + Postgres + RLS), React Router v7.

**Key design decisions:**
- Mobile-first, max-width `max-w-lg` centered layout with a fixed bottom nav (`src/components/BottomNav.tsx`)
- Tailwind v4 uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`) in `src/index.css`
- Path alias `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`)
- All Supabase queries respect RLS — every table has `user_id` and policies enforce ownership

**Data flow:**
- `src/lib/supabase.ts` — typed Supabase client using `src/types/database.ts`
- `src/hooks/useAuth.ts` — session state + Google sign-in
- `src/hooks/useTransactions.ts` / `useAccounts.ts` — data fetching hooks
- `src/lib/csvParsers.ts` — bank-agnostic CSV parsing: `getHeaders`, `autoDetectMapping`, `parseWithMapping`

**Pages:**
- `/` → `DashboardPage` — net worth card, cash flow summary, 6-month spending bar chart, top categories, account list
- `/transactions` → `TransactionsPage` — searchable/filterable transaction list grouped by date
- `/import` → `ImportPage` — 4-step universal CSV import (Upload → Map Columns → Preview → Success)
- `/accounts` → `AccountsPage` — CRUD for accounts with net worth summary

**CSV Import flow** (`src/pages/ImportPage.tsx`):
1. **Upload** — drop zone only, no account required upfront
2. **Map Columns** — auto-detected column mapping with override dropdowns; single vs. split debit/credit mode; optional type column (for CSVs where amounts are always positive and a "Transaction Type" column says "Debit"/"Credit")
3. **Preview** — account selector with inline account creation; summary badges (new / already imported / skipped); skipped row detail; duplicate detection via client-side Set keyed on `date|description|amount`
4. **Success** — import count + reset

**CSV parsing** (`src/lib/csvParsers.ts`):
- `autoDetectMapping` — regex keyword matching on lowercased headers for date, description, amount, debit, credit, typeColumn
- `normalizeDate` — handles `MM/DD/YYYY`, `YYYY/MM/DD`, `MM/DD/YY` (2-digit year), `YYYY-MM-DD`, `MM-DD-YYYY`, `MM-DD-YY`; validates month (1–12) and day (1–31) before accepting
- `parseWithMapping` — returns `ParseResult` with skipped rows and reasons; NaN-safe amount handling
- Credit transactions auto-assigned the system "Income" category at import time (since transaction sign is derived from `category.is_income`, not a DB column)

**Database schema** (see `supabase/schema.sql`):
- `accounts` — user-owned accounts with type (checking/savings/credit/investment/loan)
- `categories` — system categories (user_id = null) + user-custom categories; includes Income, Paycheck, Transfer, Credit Card Payment, and standard expense categories
- `category_rules` — pattern-matching rules for auto-categorization (not yet wired to UI)
- `transactions` — unique constraint on `(user_id, account_id, date, description, amount)` prevents CSV re-import duplicates; no `type`/`is_income` column — display sign is derived from `category.is_income`

**Important implementation notes:**
- Transaction income/expense display derives from `category?.is_income`, not a column on `transactions` — uncategorized transactions appear as expenses
- Use `.maybeSingle()` (not `.single()`) when fetching optional system categories to avoid errors when a category is missing
- Do not reference specific bank names (e.g. Chase, Capital One, PNC) in any user-facing content

## Bank sync (Plaid)

Automatic account linking + transaction sync, alongside the manual CSV/account flows (kept as fallbacks).

**Security model:** Plaid `access_token`s live only in the `plaid_items` table, which has RLS enabled with **no policies** — the browser can never read it. Only Edge Functions using the **service-role key** touch it. The client only handles short-lived Plaid link/public tokens. Every function derives `user_id` from the verified Supabase JWT, never from the request body.

**Edge Functions** (`supabase/functions/`, Deno; all Plaid SDK usage isolated to `_shared/plaid.ts` so the provider can be swapped):
- `plaid-link-token` — creates a Link token; pass `item_id` for update-mode (reconnect)
- `plaid-exchange` — exchanges public token, stores the item, upserts one account per Plaid account (`is_manual=false`)
- `plaid-sync` — incremental `/transactions/sync` (cursor model), idempotent upsert on `plaid_transaction_id`, refreshes balances; sets item `status` to `login_required`/`error` on failure
- `plaid-items` — lists the user's items **without** `access_token` (the client's only window onto `plaid_items`, for connection-health UI)
- `plaid-remove` — revokes at Plaid, converts accounts back to manual, optional transaction purge, deletes the token

**Account-type coverage:** depository + credit get full transaction sync; investment/loan are **balance-only** (no holdings yet). **Categorization:** Plaid sync assigns categories via `src/lib/plaidCategoryMap.ts` precedence — user `category_rules` → Plaid `personal_finance_category` → Income default for credits → null. CSV import shares `assignCategory` (`src/lib/categorize.ts`).

**Cross-source dedup:** Plaid rows dedup on `plaid_transaction_id`; CSV/manual rows on the composite `(user_id, account_id, date, description, amount)` constraint. Plaid accounts always get fresh `account_id`s, so the two never collide on the composite key — but if you both CSV-import *and* Plaid-link the same real-world account, transactions appear once per source (not merged). Avoid linking a bank for an account you already import via CSV.

**Sync trigger:** manual "Sync now" button on Accounts. Webhook/cron auto-sync is a future enhancement.
