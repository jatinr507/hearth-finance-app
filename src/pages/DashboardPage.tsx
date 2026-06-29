import { useMemo, useState, useId } from 'react'
import { startOfMonth, endOfMonth, format, subMonths, parseISO, startOfYear } from 'date-fns'
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts'
import { Card } from '@/components/ui/Card'
import { PrivacyToggle } from '@/components/PrivacyToggle'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { formatAmount } from '@/lib/utils'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { signedAmount, incomeAmount, expenseAmount, txnKind } from '@/lib/txnClassify'
import { groupByCategory, groupByMonth } from '@/lib/reportAggregations'
import type { User } from '@supabase/supabase-js'

interface DashboardPageProps {
  user: User
}

const RANGES = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
] as const

type RangeLabel = typeof RANGES[number]['label']

const CASH_FLOW_PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
] as const

type CashFlowPeriod = typeof CASH_FLOW_PERIODS[number]['key']

export function DashboardPage({ user }: DashboardPageProps) {
  const { transactions, loading: txLoading } = useTransactions(user.id)
  const { accounts, loading: accLoading } = useAccounts(user.id)
  const [netWorthRange, setNetWorthRange] = useState<RangeLabel>('6M')
  const [cashFlowPeriod, setCashFlowPeriod] = useState<CashFlowPeriod>('month')
  const gradientId = useId()
  const { hidden } = usePrivacy()
  // Privacy-aware formatter: pass a `total` to mask as a percentage, omit it to
  // mask as dots (for figures with no meaningful whole, e.g. net worth).
  const fmt = (v: number, total?: number) => formatAmount(v, { hidden, total })

  const now = useMemo(() => new Date(), [])

  const cashFlowRange = useMemo(() => {
    switch (cashFlowPeriod) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now), label: 'This month' }
      case 'lastMonth': {
        const last = subMonths(now, 1)
        return { start: startOfMonth(last), end: endOfMonth(last), label: 'Last month' }
      }
      case '3m':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now), label: 'Last 3 months' }
      case '6m':
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now), label: 'Last 6 months' }
      case 'year':
        return { start: startOfYear(now), end: endOfMonth(now), label: 'This year' }
      case 'all':
        return { start: null, end: null, label: 'All time' }
    }
  }, [cashFlowPeriod, now])

  const cashFlowTx = useMemo(
    () => transactions.filter((t) => {
      if (!cashFlowRange.start || !cashFlowRange.end) return true
      const d = parseISO(t.date)
      return d >= cashFlowRange.start && d <= cashFlowRange.end
    }),
    [transactions, cashFlowRange],
  )

  const income = useMemo(
    () => cashFlowTx.reduce((s, t) => s + incomeAmount(t), 0),
    [cashFlowTx],
  )

  const spending = useMemo(
    () => cashFlowTx.reduce((s, t) => s + expenseAmount(t), 0),
    [cashFlowTx],
  )

  const netWorth = useMemo(() => {
    return accounts.reduce((sum, a) => {
      return a.type === 'credit' || a.type === 'loan' ? sum - a.balance : sum + a.balance
    }, 0)
  }, [accounts])

  const netWorthHistory = useMemo(() => {
    const months = RANGES.find((r) => r.label === netWorthRange)?.months ?? 6
    // Build month buckets from oldest → newest
    const buckets = Array.from({ length: months + 1 }, (_, i) => {
      const month = subMonths(now, months - i)
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const net = transactions
        .filter((t) => { const d = parseISO(t.date); return d >= start && d <= end })
        .reduce((s, t) => s + (txnKind(t) === 'transfer' ? 0 : signedAmount(t)), 0)
      return { month: format(month, months > 6 ? 'MMM yy' : 'MMM'), net, label: format(month, 'MMMM yyyy') }
    })
    // Work backwards from current net worth to reconstruct history
    let running = netWorth
    const result = [...buckets].reverse().map((b) => {
      const point = { month: b.month, netWorth: running, label: b.label }
      running -= b.net
      return point
    })
    return result.reverse()
  }, [transactions, netWorth, netWorthRange, now])

  const netWorthTrend = netWorthHistory.length >= 2
    ? netWorthHistory[netWorthHistory.length - 1].netWorth - netWorthHistory[0].netWorth
    : 0

  const monthlyData = useMemo(
    () => groupByMonth(transactions, 6, expenseAmount, now).map((b) => ({ month: b.month, total: b.value })),
    [transactions, now],
  )

  const topCategories = useMemo(
    () => groupByCategory(cashFlowTx, 'expense').slice(0, 5),
    [cashFlowTx],
  )

  const netCashFlow = income - spending
  const avgSpending = useMemo(
    () => monthlyData.slice(0, 5).reduce((s, d) => s + d.total, 0) / 5,
    [monthlyData],
  )

  // Denominators for privacy-mode percentages.
  const cashFlowTotal = income + spending
  const spendingTrendTotal = useMemo(() => monthlyData.reduce((s, d) => s + d.total, 0), [monthlyData])
  const categoryTotal = useMemo(() => topCategories.reduce((s, c) => s + c.total, 0), [topCategories])

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
      <div className="pb-4 lg:pb-6 flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Good {getGreeting()},</p>
          <h1 className="text-xl font-bold text-ink">
            {user.user_metadata?.name?.split(' ')[0] ?? 'there'}
          </h1>
        </div>
        <PrivacyToggle />
      </div>

      {/* Desktop 2-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 space-y-4 lg:space-y-0">
        {/* Left column */}
        <div className="space-y-4">
          {/* Net Worth — dark ink hero card with chart */}
          <Card className="bg-ink border-0 rounded-lg">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-on-ink-muted text-xs font-semibold uppercase tracking-widest">Net Worth</p>
                <p className="text-3xl font-bold mt-1 text-on-ink amount">{fmt(netWorth)}</p>
                <p className={`text-xs mt-1 font-medium ${netWorthTrend >= 0 ? 'text-sage' : 'text-rust'}`}>
                  {netWorthTrend >= 0 ? '↑' : '↓'} {fmt(Math.abs(netWorthTrend))} this period
                </p>
              </div>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setNetWorthRange(r.label)}
                    className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                      netWorthRange === r.label
                        ? 'bg-clay text-white'
                        : 'text-on-ink-muted hover:text-on-ink'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 -mx-4 -mb-4">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={netWorthHistory} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#BE6E46" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#BE6E46" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9A8E79' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [fmt(v as number), 'Net Worth']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #3A332B', backgroundColor: '#29241E', color: '#F2EBDD' }}
                  />
                  <Area type="monotone" dataKey="netWorth" stroke="#BE6E46" strokeWidth={2} fill={`url(#${gradientId})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Cash Flow */}
          <div>
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
              {CASH_FLOW_PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setCashFlowPeriod(p.key)}
                  className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    cashFlowPeriod === p.key
                      ? 'bg-ink text-on-ink'
                      : 'bg-sand text-muted hover:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="flex items-center gap-2 text-sage mb-1">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-xs font-semibold">Income</span>
                </div>
                <p className="text-lg font-bold text-ink amount">{fmt(income, cashFlowTotal)}</p>
                <p className="text-xs text-muted">{cashFlowRange.label}</p>
              </Card>
              <Card>
                <div className="flex items-center gap-2 text-rust mb-1">
                  <ArrowDownRight className="w-4 h-4" />
                  <span className="text-xs font-semibold">Spending</span>
                </div>
                <p className="text-lg font-bold text-ink amount">{fmt(spending, cashFlowTotal)}</p>
                <p className="text-xs text-muted">{cashFlowRange.label}</p>
              </Card>
            </div>
          </div>

          {/* Net savings line */}
          <p className={`text-sm font-medium -mt-1 px-1 ${netCashFlow >= 0 ? 'text-sage' : 'text-rust'}`}>
            {netCashFlow >= 0 ? '+' : ''}{fmt(netCashFlow)} {netCashFlow >= 0 ? 'saved' : 'over budget'} · {cashFlowRange.label.toLowerCase()}
          </p>

          {/* Chart */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-muted" />
              <h2 className="text-sm font-semibold text-ink-2">Spending Trend</h2>
              <span className="text-xs text-muted ml-auto">Avg {fmt(avgSpending)}/mo</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barSize={28}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A7F6D' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => [fmt(v as number, spendingTrendTotal), 'Spending']}
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
                    <span className="text-sm font-semibold text-ink amount w-20 text-right">{fmt(cat.total, categoryTotal)}</span>
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
                      {fmt(acc.balance)}
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
