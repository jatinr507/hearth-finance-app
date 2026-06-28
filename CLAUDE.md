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

Run `supabase/schema.sql` in the Supabase SQL editor to create tables, RLS policies, and seed default categories.

Enable Google OAuth in Supabase Dashboard → Authentication → Providers → Google.

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
- `src/lib/csvParsers.ts` — Chase, Capital One, and PNC CSV parsing with auto-detection

**Pages:**
- `/` → `DashboardPage` — net worth card, cash flow summary, 6-month spending bar chart, top categories, account list
- `/transactions` → `TransactionsPage` — searchable/filterable transaction list grouped by date
- `/import` → `ImportPage` — CSV upload with bank auto-detection, preview before saving, upserts with duplicate guard
- `/accounts` → `AccountsPage` — CRUD for accounts with net worth summary

**Database schema** (see `supabase/schema.sql`):
- `accounts` — user-owned accounts with type (checking/savings/credit/investment/loan)
- `categories` — system categories (user_id = null) + user-custom categories
- `category_rules` — pattern-matching rules for auto-categorization (not yet wired to UI)
- `transactions` — unique constraint on `(user_id, account_id, date, description, amount)` prevents CSV re-import duplicates

## Planned V2

Plaid integration for automatic bank sync — store `access_token` server-side via Supabase Edge Functions, use webhooks for new transactions. Supported institutions: Chase, PNC, Capital One.
