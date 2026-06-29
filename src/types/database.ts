export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan'
export type TransactionSource = 'csv' | 'manual' | 'plaid'
export type TransactionDirection = 'inflow' | 'outflow'

export type PlaidItemStatus = 'good' | 'login_required' | 'error'

// NOTE: these are `type` aliases, not `interface`s, on purpose. supabase-js's
// GenericSchema requires each table's Row/Insert/Update to satisfy
// `Record<string, unknown>`, which TS interfaces do NOT (they lack an implicit
// index signature) — using `interface` here makes every query resolve to `never`.
export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  institution: string
  balance: number
  plaid_item_id: string | null
  plaid_account_id: string | null
  is_manual: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  user_id: string | null
  name: string
  color: string
  icon: string
  is_income: boolean
  is_system: boolean
}

export type CategoryRule = {
  id: string
  user_id: string
  pattern: string
  category_id: string
}

export type Transaction = {
  id: string
  user_id: string
  account_id: string
  date: string
  description: string
  amount: number
  category_id: string | null
  source: TransactionSource
  plaid_transaction_id: string | null
  pending: boolean
  direction: TransactionDirection | null
  notes: string | null
  created_at: string
  account?: Account
  category?: Category
}

// plaid_items is server-only (no client RLS read access); typed for Edge Functions.
export type PlaidItem = {
  id: string
  user_id: string
  item_id: string
  access_token: string
  institution_name: string | null
  cursor: string | null
  status: PlaidItemStatus
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Tables: {
      accounts: {
        Row: Account
        // plaid_* / is_manual have DB defaults → optional on insert.
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'plaid_item_id' | 'plaid_account_id' | 'is_manual'> &
          Partial<Pick<Account, 'plaid_item_id' | 'plaid_account_id' | 'is_manual'>>
        Update: Partial<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id'>
        Update: Partial<Omit<Category, 'id'>>
        Relationships: []
      }
      category_rules: {
        Row: CategoryRule
        Insert: Omit<CategoryRule, 'id'>
        Update: Partial<Omit<CategoryRule, 'id' | 'user_id'>>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        // plaid_transaction_id / pending have DB defaults → optional on insert.
        Insert: Omit<Transaction, 'id' | 'created_at' | 'account' | 'category' | 'plaid_transaction_id' | 'pending' | 'direction'> &
          Partial<Pick<Transaction, 'plaid_transaction_id' | 'pending' | 'direction'>>
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'account' | 'category'>>
        Relationships: []
      }
      plaid_items: {
        Row: PlaidItem
        Insert: Omit<PlaidItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PlaidItem, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
    }
  }
}
