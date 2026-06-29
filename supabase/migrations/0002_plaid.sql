-- V2: Plaid bank sync support
-- Idempotent migration. Safe to run on an existing schema.

-- ── plaid_items ─────────────────────────────────────────────────────────────
-- One row per linked Plaid Item (institution login). Holds the access_token.
-- SECURITY: RLS is enabled with NO policies, so the anon/auth client can never
-- read any row. Only Edge Functions using the service-role key (which bypasses
-- RLS) touch this table.
create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_name text,
  cursor text,
  status text not null default 'good' check (status in ('good', 'login_required', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plaid_items enable row level security;
-- Intentionally NO policies: clients get zero rows; service role bypasses RLS.

create index if not exists plaid_items_user on public.plaid_items(user_id);

-- ── accounts: link to Plaid ─────────────────────────────────────────────────
alter table public.accounts
  add column if not exists plaid_item_id uuid references public.plaid_items(id) on delete set null,
  add column if not exists plaid_account_id text,
  add column if not exists is_manual boolean not null default true;

-- One app account per Plaid account.
create unique index if not exists accounts_plaid_account
  on public.accounts(user_id, plaid_account_id)
  where plaid_account_id is not null;

-- ── transactions: Plaid identity + pending state ────────────────────────────
alter table public.transactions
  add column if not exists plaid_transaction_id text,
  add column if not exists pending boolean not null default false;

-- Stable dedup/update key for Plaid-sourced rows (survives pending -> posted).
create unique index if not exists transactions_plaid_txn
  on public.transactions(user_id, plaid_transaction_id)
  where plaid_transaction_id is not null;
