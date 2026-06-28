import { useMemo } from 'react'
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns'
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import type { User } from '@supabase/supabase-js'

interface DashboardPageProps {
  user: User
}

export function DashboardPage({ user }: DashboardPageProps) {
  const { transactions, loading: txLoading } = useTransactions(user.id)
  const { accounts, loading: accLoading } = useAccounts(user.id)

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const thisMonthTx = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.date)
      return d >= monthStart && d <= monthEnd
    }),
    [transactions, monthStart, monthEnd],
  )

  const income = useMemo(
    () => thisMonthTx.filter((t) => t.category?.is_income).reduce((s, t) => s + t.amount, 0),
    [thisMonthTx],
  )

  const spending = useMemo(
    () => thisMonthTx.filter((t) => !t.category?.is_income).reduce((s, t) => s + t.amount, 0),
    [thisMonthTx],
  )

  const netWorth = useMemo(() => {
    return accounts.reduce((sum, a) => {
      return a.type === 'credit' || a.type === 'loan' ? sum - a.balance : sum + a.balance
    }, 0)
  }, [accounts])

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i)
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const total = transactions
        .filter((t) => {
          const d = new Date(t.date)
          return d >= start && d <= end && !t.category?.is_income
        })
        .reduce((s, t) => s + t.amount, 0)
      return { month: format(month, 'MMM'), total }
    })
  }, [transactions, now])

  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number }>()
    thisMonthTx
      .filter((t) => !t.category?.is_income && t.category)
      .forEach((t) => {
        const cat = t.category!
        const existing = map.get(cat.id) ?? { name: cat.name, color: cat.color, total: 0 }
        map.set(cat.id, { ...existing, total: existing.total + t.amount })
      })
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [thisMonthTx])

  const netCashFlow = income - spending
  const avgSpending = useMemo(
    () => monthlyData.slice(0, 5).reduce((s, d) => s + d.total, 0) / 5,
    [monthlyData],
  )

  if (txLoading || accLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10 px-4 lg:px-8 pt-6 lg:pt-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="pb-4 lg:pb-6">
        <p className="text-sm text-muted">Good {getGreeting()},</p>
        <h1 className="text-xl font-bold text-ink">
          {user.user_metadata?.name?.split(' ')[0] ?? 'there'}
        </h1>
      </div>

      {/* Desktop 2-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 space-y-4 lg:space-y-0">
        {/* Left column */}
        <div className="space-y-4">
          {/* Net Worth — dark ink hero card */}
          <Card className="bg-ink border-0 rounded-lg">
            <p className="text-on-ink-muted text-xs font-semibold uppercase tracking-widest">Net Worth</p>
            <p className="text-3xl font-bold mt-1 text-on-ink amount">{formatCurrency(netWorth)}</p>
            <p className="text-on-ink-muted text-xs mt-2">{format(now, 'MMMM yyyy')}</p>
          </Card>

          {/* Cash Flow */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="flex items-center gap-2 text-sage mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-semibold">Income</span>
              </div>
              <p className="text-lg font-bold text-ink amount">{formatCurrency(income)}</p>
              <p className="text-xs text-muted">This month</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-rust mb-1">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-xs font-semibold">Spending</span>
              </div>
              <p className="text-lg font-bold text-ink amount">{formatCurrency(spending)}</p>
              <p className="text-xs text-muted">This month</p>
            </Card>
          </div>

          {/* Net savings line */}
          <p className={`text-sm font-medium -mt-1 px-1 ${netCashFlow >= 0 ? 'text-sage' : 'text-rust'}`}>
            {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)} {netCashFlow >= 0 ? 'saved' : 'over budget'} this month
          </p>

          {/* Chart */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-muted" />
              <h2 className="text-sm font-semibold text-ink-2">Spending Trend</h2>
              <span className="text-xs text-muted ml-auto">Avg {formatCurrency(avgSpending)}/mo</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barSize={28}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A7F6D' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Spending']}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2D9CA', boxShadow: '0 4px 12px rgba(43,38,32,0.08)', backgroundColor: '#FBF8F2' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((_, i) => (
                    <Cell key={i} fill={i === 5 ? '#BE6E46' : '#E7DCC9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {topCategories.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-muted" />
                <h2 className="text-sm font-semibold text-ink-2">Spending by Category</h2>
              </div>
              <div className="space-y-3">
                {topCategories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-sm text-ink w-24 truncate">{cat.name}</span>
                    <div className="flex-1 h-1.5 bg-sand rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(cat.total / topCategories[0].total) * 100}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-ink amount w-20 text-right">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {accounts.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-muted" />
                <h2 className="text-sm font-semibold text-ink-2">Accounts</h2>
              </div>
              <div className="space-y-3">
                {accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{acc.name}</p>
                      <p className="text-xs text-muted">{acc.institution}</p>
                    </div>
                    <span className={`text-sm font-semibold amount ${acc.type === 'credit' || acc.type === 'loan' ? 'text-rust' : 'text-ink'}`}>
                      {formatCurrency(acc.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
