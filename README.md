# Hearth

**A calm, private personal finance tracker.**

Hearth is an open-source personal finance web app for tracking net worth, spending, and cash flow. Designed to be calm and private: your data lives in your own Supabase project, not a third-party aggregator. Import transactions from your bank via standard CSV export.

---

## Features

- **Dashboard** — net worth card, 6-month spending bar chart, cash flow summary, and top spending categories
- **Transactions** — searchable and filterable list grouped by date; tap any row to assign a category
- **Accounts** — add and manage checking, savings, credit, investment, and loan accounts
- **CSV Import** — auto-detection of bank format, duplicate-safe upserts, category auto-assignment via rules
- **Category rules** — keyword → category mapping applied automatically on every import
- **Auth** — Google Sign-In via Supabase, with per-user Row Level Security on all data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Backend | Supabase (Postgres + Auth + RLS) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- A free [Supabase](https://supabase.com) project
- Google OAuth credentials (for sign-in)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/jatinr507/hearth-finance-app.git
   cd hearth-finance-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase credentials in `.env`:

   | Variable | Description |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

4. **Create the database schema**

   Run `supabase/schema.sql` in the Supabase SQL editor. This creates tables, RLS policies, and seeds default categories.

5. **Enable Google OAuth**

   In your Supabase dashboard: Authentication → Providers → Google → enable and add your OAuth credentials.

6. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173).

---

## Roadmap

- **Automatic bank sync** — no more CSV exports, via a read-only bank integration
- **Secure server-side token storage** — via Supabase Edge Functions
- **Webhook-driven transaction updates** — stay current without manual imports
