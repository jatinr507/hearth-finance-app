import { useMemo, useRef, useState } from 'react'
import { parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart3, Image, Sheet } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Card } from '@/components/ui/Card'
import { PrivacyToggle } from '@/components/PrivacyToggle'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { formatAmount } from '@/lib/utils'
import { incomeAmount, expenseAmount } from '@/lib/txnClassify'
import { buildSankey, groupByMonth, stackedSpendingByMonth, groupByCategory } from '@/lib/reportAggregations'
import { downloadPng, downloadCsv } from '@/lib/reportExport'
import { SankeyReport } from '@/components/reports/SankeyReport'
import { BarReport, type IncomeExpenseMonth } from '@/components/reports/BarReport'
import { StackedBarReport } from '@/components/reports/StackedBarReport'
import { ReportSummary } from '@/components/reports/ReportSummary'
import { ChartCarousel } from '@/components/reports/ChartCarousel'

interface ReportsPageProps {
  user: User
}

const RANGES = [
  { label: 'Current', kind: 'month', offset: 0 },
  { label: 'Last Month', kind: 'month', offset: 1 },
  { label: '3M', kind: 'range', months: 3 },
  { label: '6M', kind: 'range', months: 6 },
  { label: '1Y', kind: 'range', months: 12 },
] as const
type RangeLabel = typeof RANGES[number]['label']

const CHART_TYPES = [
  { key: 'sankey', label: 'Cash flow' },
  { key: 'bar', label: 'Income vs spending' },
  { key: 'stacked', label: 'By category' },
] as const
type ChartType = typeof CHART_TYPES[number]['key']

export function ReportsPage({ user }: ReportsPageProps) {
  const { transactions, loading: txLoading } = useTransactions(user.id)
  const { accounts, loading: accLoading } = useAccounts(user.id)
  const [range, setRange] = useState<RangeLabel>('6M')
  const [chart, setChart] = useState<ChartType>('sankey')
  const [accountIds, setAccountIds] = useState<Set<string>>(new Set())

  const now = useMemo(() => new Date(), [])

  // Resolve the active time filter into a [start, end] window plus the month-bucket
  // params (`months` count + `anchor` = the month the buckets end on) reused by the
  // bar/stacked aggregation helpers. Single-month filters collapse to one bucket.
  const { windowStart, windowEnd, months, anchor } = useMemo(() => {
    const cfg = RANGES.find((r) => r.label === range) ?? RANGES[3]
    if (cfg.kind === 'month') {
      const m = subMonths(now, cfg.offset)
      return { windowStart: startOfMonth(m), windowEnd: endOfMonth(m), months: 1, anchor: m }
    }
    return {
      windowStart: startOfMonth(subMonths(now, cfg.months - 1)),
      windowEnd: endOfMonth(now),
      months: cfg.months,
      anchor: now,
    }
  }, [range, now])

  // Apply the date range + account filter once for the whole page.
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const d = parseISO(t.date)
      if (d < windowStart || d > windowEnd) return false
      if (accountIds.size > 0 && !accountIds.has(t.account_id)) return false
      return true
    })
  }, [transactions, accountIds, windowStart, windowEnd])

  const sankey = useMemo(() => buildSankey(filtered), [filtered])

  const barData = useMemo<IncomeExpenseMonth[]>(() => {
    const inc = groupByMonth(filtered, months, incomeAmount, anchor)
    const exp = groupByMonth(filtered, months, expenseAmount, anchor)
    return inc.map((b, i) => ({
      month: b.month,
      label: b.label,
      income: b.value,
      spending: exp[i].value,
      net: b.value - exp[i].value,
    }))
  }, [filtered, months, anchor])

  const stacked = useMemo(() => stackedSpendingByMonth(filtered, months, 6, anchor), [filtered, months, anchor])

  const incomeCats = useMemo(() => groupByCategory(filtered, 'income'), [filtered])
  const expenseCats = useMemo(() => groupByCategory(filtered, 'expense'), [filtered])

  const { hidden } = usePrivacy()
  const chartRef = useRef<HTMLDivElement>(null)

  // Per-chart denominators so privacy mode can show each flow as a % of the
  // relevant whole (total inflow for Sankey, period total for the bar charts).
  const incomeTotal = useMemo(() => filtered.reduce((s, t) => s + incomeAmount(t), 0), [filtered])
  const expenseTotal = useMemo(() => filtered.reduce((s, t) => s + expenseAmount(t), 0), [filtered])
  const chartTotal =
    chart === 'sankey'
      ? Math.max(incomeTotal, expenseTotal)
      : chart === 'stacked'
        ? expenseTotal
        : incomeTotal + expenseTotal
  const formatValue = (v: number) => formatAmount(v, { hidden, total: chartTotal })

  // How many viewport-width sections the chart spans on mobile (drives the swipe
  // carousel + dot pagination). Wide charts get 2 pages, compact ones stay single.
  const chartPages =
    chart === 'sankey'
      ? sankey.nodes.length > 5
        ? 2
        : 1
      : months > 6
        ? 2
        : 1

  function toggleAccount(id: string) {
    setAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleExportImage() {
    if (chartRef.current) await downloadPng(chartRef.current, `report-${chart}-${range}.png`)
  }

  function handleExportCsv() {
    let rows: Record<string, unknown>[]
    if (chart === 'sankey') {
      rows = sankey.links.map((l) => ({
        from: sankey.nodes[l.source]?.name ?? '',
        to: sankey.nodes[l.target]?.name ?? '',
        value: hidden ? formatValue(l.value) : l.value,
      }))
    } else if (chart === 'stacked') {
      const nameById = new Map(stacked.categories.map((c) => [c.id, c.name]))
      rows = stacked.rows.map((r) => {
        const out: Record<string, unknown> = { month: r.label }
        stacked.categories.forEach((c) => {
          out[nameById.get(c.id) ?? c.id] = hidden ? formatValue(r[c.id] as number) : r[c.id]
        })
        return out
      })
    } else {
      rows = barData.map((b) => ({
        month: b.label,
        income: hidden ? formatValue(b.income) : b.income,
        spending: hidden ? formatValue(b.spending) : b.spending,
      }))
    }
    downloadCsv(rows, `report-${chart}-${range}.csv`)
  }

  if (txLoading || accLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10 px-4 lg:px-8 pt-6 lg:pt-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 pb-4 lg:pb-6">
        <BarChart3 className="w-5 h-5 text-clay" />
        <h1 className="text-xl font-bold text-ink">Reports</h1>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleExportImage}
            title="Save as image"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-sand transition-colors"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            title="Export CSV"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-sand transition-colors"
          >
            <Sheet className="w-4 h-4" />
          </button>
          <PrivacyToggle />
        </div>
      </div>

      {/* Chart type */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
        {CHART_TYPES.map((c) => (
          <button
            key={c.key}
            onClick={() => setChart(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              chart === c.key ? 'bg-clay text-on-ink' : 'bg-sand text-muted hover:text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Date range + account filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                range === r.label ? 'bg-ink text-on-ink' : 'bg-sand text-muted hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {accounts.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {accounts.map((a) => {
              const active = accountIds.size === 0 || accountIds.has(a.id)
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAccount(a.id)}
                  className={`text-xs px-2.5 py-1 rounded-pill font-medium border transition-colors ${
                    active && accountIds.has(a.id)
                      ? 'bg-tint-clay text-clay border-clay/30'
                      : 'bg-surface text-muted border-hairline hover:text-ink'
                  }`}
                >
                  {a.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Card ref={chartRef}>
        <ChartCarousel pages={chartPages}>
          {chart === 'sankey' && <SankeyReport data={sankey} formatValue={formatValue} />}
          {chart === 'bar' && <BarReport data={barData} formatValue={formatValue} />}
          {chart === 'stacked' && (
            <StackedBarReport rows={stacked.rows} categories={stacked.categories} formatValue={formatValue} />
          )}
        </ChartCarousel>
      </Card>

      <ReportSummary
        chart={chart}
        incomeTotal={incomeTotal}
        expenseTotal={expenseTotal}
        incomeCats={incomeCats}
        expenseCats={expenseCats}
        formatValue={formatValue}
      />
    </div>
  )
}
