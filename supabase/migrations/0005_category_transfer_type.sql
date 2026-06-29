-- V2: classify categories as income / expense / transfer (Monarch-style).
-- The +/- cash sign (transactions.direction) is independent of meaning. Income
-- vs Expense vs Transfer is a property of the *category*:
--   - is_income  → Income      (paychecks, interest)
--   - is_transfer → Transfer   (account-to-account moves, credit-card payments)
--   - neither    → Expense
-- Transfers are shown in the list but excluded from income/expense/cash-flow
-- totals, because moving your own money is neither earning nor spending.
-- Idempotent. Safe to run on an existing schema.

alter table public.categories
  add column if not exists is_transfer boolean not null default false;

-- Mark the system transfer-type categories.
update public.categories
  set is_transfer = true
  where user_id is null
    and name in ('Transfer', 'Credit Card Payment')
    and is_transfer = false;
