-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'investment', 'loan')),
  institution text not null,
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- System categories (shared, no user_id)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  icon text not null default '📦',
  is_income boolean not null default false,
  is_system boolean not null default false
);

-- Default system categories
insert into public.categories (name, color, icon, is_income, is_system) values
  ('Income', '#22c55e', '💰', true, true),
  ('Paycheck', '#16a34a', '💵', true, true),
  ('Transfer', '#64748b', '↔️', false, true),
  ('Food & Dining', '#f97316', '🍔', false, true),
  ('Groceries', '#84cc16', '🛒', false, true),
  ('Shopping', '#ec4899', '🛍️', false, true),
  ('Gas & Fuel', '#f59e0b', '⛽', false, true),
  ('Travel', '#06b6d4', '✈️', false, true),
  ('Entertainment', '#a855f7', '🎬', false, true),
  ('Subscriptions', '#8b5cf6', '📱', false, true),
  ('Utilities', '#0ea5e9', '💡', false, true),
  ('Healthcare', '#ef4444', '🏥', false, true),
  ('Insurance', '#64748b', '🛡️', false, true),
  ('Rent & Mortgage', '#1d4ed8', '🏠', false, true),
  ('Credit Card Payment', '#64748b', '💳', false, true),
  ('Other', '#94a3b8', '📦', false, true)
on conflict do nothing;

-- Category auto-assign rules
create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null,
  category_id uuid not null references public.categories(id) on delete cascade
);

-- Transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(12, 2) not null,
  category_id uuid references public.categories(id) on delete set null,
  source text not null check (source in ('csv', 'manual', 'plaid')) default 'csv',
  notes text,
  created_at timestamptz not null default now(),
  -- Prevent duplicate imports from CSV
  unique (user_id, account_id, date, description, amount)
);

-- Indexes
create index if not exists transactions_user_date on public.transactions(user_id, date desc);
create index if not exists transactions_account on public.transactions(account_id);

-- Row Level Security
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.category_rules enable row level security;
alter table public.transactions enable row level security;

-- RLS Policies: accounts
create policy "Users manage own accounts"
  on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies: categories (system + own)
create policy "Users read system and own categories"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users insert own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users update own categories"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- RLS Policies: category_rules
create policy "Users manage own rules"
  on public.category_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies: transactions
create policy "Users manage own transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
