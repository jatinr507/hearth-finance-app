import { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TransactionCategorySheet } from '@/components/TransactionCategorySheet'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTransactions } from '@/hooks/useTransactions'
import type { User } from '@supabase/supabase-js'
import type { Transaction } from '@/types/database'

interface TransactionsPageProps {
  user: User
}

export function TransactionsPage({ user }: TransactionsPageProps) {
  const { transactions, loading, refetch } = useTransactions(user.id)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase())
      const matchesType =
        filterType === 'all' ||
        (filterType === 'income' && t.category?.is_income) ||
        (filterType === 'expense' && !t.category?.is_income)
      return matchesSearch && matchesType
    })
  }, [transactions, search, filterType])

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    filtered.forEach((t) => {
      const existing = map.get(t.date) ?? []
      map.set(t.date, [...existing, t])
    })
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-paper z-10 px-4 lg:px-8 pt-6 lg:pt-8 pb-3 space-y-3">
        <h1 className="text-xl font-bold text-ink">Transactions</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-hairline rounded-sm text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-clay"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-pill text-xs font-medium capitalize transition-colors ${
                filterType === f
                  ? 'bg-clay text-on-ink'
                  : 'bg-surface text-ink-2 border border-hairline'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-auto text-xs text-muted">
            <Filter className="w-3 h-3" />
            {filtered.length} transactions
          </div>
        </div>
      </div>

      {/* Transaction list */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg">No transactions yet</p>
          <p className="text-sm mt-1">Import a CSV to get started</p>
        </div>
      ) : (
        <div className="px-4 lg:px-8 space-y-4 mt-2">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                {formatDate(date)}
              </p>
              <div className="bg-surface rounded-md border border-hairline divide-y divide-hairline overflow-hidden">
                {txs.map((t) => (
                  <TransactionRow key={t.id} transaction={t} onTap={setEditingTx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TransactionCategorySheet
        transaction={editingTx}
        userId={user.id}
        onClose={() => setEditingTx(null)}
        onUpdated={refetch}
      />
    </div>
  )
}

function TransactionRow({
  transaction: t,
  onTap,
}: {
  transaction: Transaction
  onTap: (t: Transaction) => void
}) {
  const isIncome = t.category?.is_income ?? false

  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-paper transition-colors text-left"
      onClick={() => onTap(t)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{t.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted">{t.account?.name ?? 'Unknown account'}</p>
          {t.category && (
            <Badge label={t.category.name} color={t.category.color} />
          )}
        </div>
      </div>
      <span className={`text-sm font-semibold amount ${isIncome ? 'text-sage' : 'text-ink'}`}>
        {isIncome ? '+' : '−'}{formatCurrency(t.amount)}
      </span>
    </button>
  )
}
