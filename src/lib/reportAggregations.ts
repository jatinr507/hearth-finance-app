import { startOfMonth, endOfMonth, format, subMonths, parseISO } from 'date-fns'
import type { Transaction } from '@/types/database'
import { signedAmount, incomeAmount, expenseAmount, txnKind, type TxnKind } from '@/lib/txnClassify'

// Shared, pure aggregation helpers used by both the Dashboard and Reports.
// All sign/direction logic is delegated to txnClassify/txnDirection — these
// helpers never re-derive it.

export interface CategoryTotal {
  id: string
  name: string
  color: string
  total: number
}

// Sum a kind's transactions by category, largest first. `expense`/`income` use
// their positive-magnitude selectors; other kinds fall back to |signedAmount|.
export function groupByCategory(
  txns: Transaction[],
  kind: TxnKind,
): CategoryTotal[] {
  const amountOf = (t: Transaction) =>
    kind === 'expense' ? expenseAmount(t) : kind === 'income' ? incomeAmount(t) : Math.abs(signedAmount(t))
  const map = new Map<string, CategoryTotal>()
  txns
    .filter((t) => txnKind(t) === kind && t.category)
    .forEach((t) => {
      const cat = t.category!
      const existing = map.get(cat.id) ?? { id: cat.id, name: cat.name, color: cat.color, total: 0 }
      existing.total += amountOf(t)
      map.set(cat.id, existing)
    })
  return Array.from(map.values())
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
}

export interface MonthBucket {
  month: string // short label, e.g. "Apr" or "Apr 25"
  label: string // full label, e.g. "April 2025"
  value: number
}

// Build `months` consecutive month buckets ending with the current month,
// summing `selector` over the transactions that fall in each month.
export function groupByMonth(
  txns: Transaction[],
  months: number,
  selector: (t: Transaction) => number,
  now: Date = new Date(),
): MonthBucket[] {
  return Array.from({ length: months }, (_, i) => {
    const month = subMonths(now, months - 1 - i)
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const value = txns
      .filter((t) => {
        const d = parseISO(t.date)
        return d >= start && d <= end
      })
      .reduce((s, t) => s + selector(t), 0)
    return {
      month: format(month, months > 6 ? 'MMM yy' : 'MMM'),
      label: format(month, 'MMMM yyyy'),
      value,
    }
  })
}

// Stacked spending: one row per month, with a key per category. Returns the
// rows plus the category metadata (id/name/color) needed to render the stack.
export interface StackedMonth {
  month: string
  label: string
  [categoryId: string]: string | number
}

export function stackedSpendingByMonth(
  txns: Transaction[],
  months: number,
  topN = 6,
  now: Date = new Date(),
): { rows: StackedMonth[]; categories: CategoryTotal[] } {
  // Pick the top categories across the whole window so the stack keys are stable.
  const windowStart = startOfMonth(subMonths(now, months - 1))
  const windowTxns = txns.filter((t) => parseISO(t.date) >= windowStart)
  const categories = groupByCategory(windowTxns, 'expense').slice(0, topN)
  const catIds = new Set(categories.map((c) => c.id))

  const rows: StackedMonth[] = Array.from({ length: months }, (_, i) => {
    const month = subMonths(now, months - 1 - i)
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const row: StackedMonth = {
      month: format(month, months > 6 ? 'MMM yy' : 'MMM'),
      label: format(month, 'MMMM yyyy'),
    }
    categories.forEach((c) => (row[c.id] = 0))
    txns
      .filter((t) => {
        const d = parseISO(t.date)
        return d >= start && d <= end && txnKind(t) === 'expense' && t.category && catIds.has(t.category.id)
      })
      .forEach((t) => {
        const id = t.category!.id
        row[id] = (row[id] as number) + expenseAmount(t)
      })
    return row
  })

  return { rows, categories }
}

export interface SankeyData {
  nodes: { name: string; color?: string }[]
  links: { source: number; target: number; value: number }[]
}

// Cash-flow Sankey: income-source categories → a central "Cash" node →
// expense categories. Transfers are excluded (moving your own money).
export function buildSankey(txns: Transaction[]): SankeyData {
  const income = groupByCategory(txns, 'income')
  const expense = groupByCategory(txns, 'expense')
  if (income.length === 0 && expense.length === 0) {
    return { nodes: [], links: [] }
  }

  const nodes: { name: string; color?: string }[] = []
  const links: { source: number; target: number; value: number }[] = []

  // Central node first so its index is stable.
  const cashIndex = nodes.push({ name: 'Cash', color: '#BE6E46' }) - 1

  income.forEach((c) => {
    const idx = nodes.push({ name: c.name, color: c.color }) - 1
    links.push({ source: idx, target: cashIndex, value: c.total })
  })
  expense.forEach((c) => {
    const idx = nodes.push({ name: c.name, color: c.color }) - 1
    links.push({ source: cashIndex, target: idx, value: c.total })
  })

  return { nodes, links }
}
