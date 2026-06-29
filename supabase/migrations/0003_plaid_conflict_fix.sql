-- V2 fix: ON CONFLICT upserts need real UNIQUE constraints, not partial indexes.
-- PostgREST's .upsert({ onConflict }) cannot target a partial unique index (its
-- WHERE predicate can't be expressed), so the prior partial indexes raised
-- 42P10 "no unique or exclusion constraint matching the ON CONFLICT specification".
-- A plain UNIQUE constraint treats NULLs as distinct, so manual accounts
-- (plaid_account_id IS NULL) and CSV/manual transactions (plaid_transaction_id
-- IS NULL) are unaffected — multiple NULLs are allowed.
-- Idempotent. Safe to run on an existing schema.

-- ── accounts: (user_id, plaid_account_id) ───────────────────────────────────
drop index if exists public.accounts_plaid_account;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_user_plaid_account'
  ) then
    alter table public.accounts
      add constraint accounts_user_plaid_account unique (user_id, plaid_account_id);
  end if;
end $$;

-- ── transactions: (user_id, plaid_transaction_id) ───────────────────────────
drop index if exists public.transactions_plaid_txn;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_user_plaid_txn'
  ) then
    alter table public.transactions
      add constraint transactions_user_plaid_txn unique (user_id, plaid_transaction_id);
  end if;
end $$;
