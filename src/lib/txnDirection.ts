import type { Transaction } from '@/types/database'

// Single source of truth for a transaction's cash-flow direction.
//
// New rows (CSV + Plaid) persist `direction` explicitly. Legacy rows predate
// that column and fall back to the old heuristic: a transaction counts as an
// inflow only if its category is flagged as income. Uncategorized legacy rows
// remain outflows, matching prior behavior.
export function isInflow(t: Pick<Transaction, 'direction' | 'category'>): boolean {
  if (t.direction) return t.direction === 'inflow'
  return t.category?.is_income ?? false
}

// Map a parsed debit/credit type to a stored direction.
// Credit = money into the account = inflow; debit = money out = outflow.
export function directionFromType(type: 'debit' | 'credit'): 'inflow' | 'outflow' {
  return type === 'credit' ? 'inflow' : 'outflow'
}
