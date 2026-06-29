-- V2: store each transaction's cash-flow direction explicitly.
-- Previously the +/- sign was inferred from category.is_income, which loses
-- information: a credit that isn't "income" (e.g. a transfer in / deposit) was
-- indistinguishable from an expense, so money IN displayed as money OUT.
--
-- Following Plaid's amount convention (positive = money OUT of the account,
-- negative = money IN), we now persist 'inflow' | 'outflow' per transaction.
-- Nullable: legacy rows fall back to category.is_income in the app.
-- Idempotent. Safe to run on an existing schema.

alter table public.transactions
  add column if not exists direction text
    check (direction in ('inflow', 'outflow'));
