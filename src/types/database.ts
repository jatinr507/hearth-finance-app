export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'loan'
export type TransactionSource = 'csv' | 'manual' | 'plaid'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  institution: string
  balance: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  color: string
  icon: string
  is_income: boolean
  is_system: boolean
}

export interface CategoryRule {
  id: string
  user_id: string
  pattern: string
  category_id: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  date: string
  description: string
  amount: number
  category_id: string | null
  source: TransactionSource
  notes: string | null
  created_at: string
  account?: Account
  category?: Category
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id'>
        Update: Partial<Omit<Category, 'id'>>
      }
      category_rules: {
        Row: CategoryRule
        Insert: Omit<CategoryRule, 'id'>
        Update: Partial<Omit<CategoryRule, 'id' | 'user_id'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'account' | 'category'>
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'account' | 'category'>>
      }
    }
  }
}
