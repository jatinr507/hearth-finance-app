import type { Transaction } from '@/types/database'
import { isInflow } from './txnDirection'

// Monarch-style classification. A transaction's *meaning* comes from its
// category type — independent of the +/- cash sign (which reflects direction).
//   income   → paychecks, interest, etc.
//   transfer → account-to-account moves, credit-card payments (excluded from
//              income/expense/cash-flow totals — moving your own money)
//   expense  → everything else, including uncategorized rows
export type TxnKind = 'income' | 'expense' | 'transfer'

type Classifiable = Pick<Transaction, 'category'>

export function txnKind(t: Classifiable): TxnKind {
  const c = t.category
  if (c?.is_transfer) return 'transfer'
  if (c?.is_income) return 'income'
  return 'expense'
}

// Signed cash contribution: money in is positive, money out negative.
export function signedAmount(t: Pick<Transaction, 'direction' | 'category' | 'amount'>): number {
  return isInflow(t) ? t.amount : -t.amount
}

// Amount this transaction contributes to Income totals (0 unless income-type).
// Uses the signed value so a reversal/refund of income nets correctly.
export function incomeAmount(t: Pick<Transaction, 'direction' | 'category' | 'amount'>): number {
  return txnKind(t) === 'income' ? signedAmount(t) : 0
}

// Amount this transaction contributes to Expense (spending) totals as a positive
// number (0 unless expense-type). A refund into an expense category (money in)
// reduces the total, matching Monarch's "negative expense" behavior.
export function expenseAmount(t: Pick<Transaction, 'direction' | 'category' | 'amount'>): number {
  return txnKind(t) === 'expense' ? -signedAmount(t) : 0
}
