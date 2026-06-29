import { Card } from '@/components/ui/Card'
import { usePrivacy } from '@/contexts/PrivacyContext'
import type { CategoryTotal } from '@/lib/reportAggregations'

export type ReportChart = 'sankey' | 'bar' | 'stacked'

interface ReportSummaryProps {
  chart: ReportChart
  incomeTotal: number
  expenseTotal: number
  incomeCats: CategoryTotal[]
  expenseCats: CategoryTotal[]
  formatValue: (value: number) => string
}

// Summary + breakdown panel shown beneath the chart. Content adapts to the tab:
// the By-category tab leads with a spending breakdown; the others lead with the
// income / expenses / savings summary.
export function ReportSummary({ chart, incomeTotal, expenseTotal, incomeCats, expenseCats, formatValue }: ReportSummaryProps) {
  const { hidden } = usePrivacy()
  const net = incomeTotal - expenseTotal
  const savingsRate = incomeTotal > 0 ? Math.round((net / incomeTotal) * 100) : 0

  // By-category → break down spending; otherwise break down whatever side has data.
  const breakdownIsIncome = chart === 'bar' ? false : chart === 'stacked' ? false : expenseCats.length === 0 && incomeCats.length > 0
  const cats = breakdownIsIncome ? incomeCats : expenseCats
  const denom = breakdownIsIncome ? incomeTotal : expenseTotal
  const breakdownTitle = breakdownIsIncome ? 'Income breakdown' : 'Spending breakdown'

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold text-ink-2 mb-3">Summary</h2>
        <div className="space-y-3">
          <Row dotClass="bg-sage" label="Total income" value={formatValue(incomeTotal)} valueClass="text-sage" />
          <div className="border-t border-hairline" />
          <Row dotClass="bg-rust" label="Total expenses" value={formatValue(expenseTotal)} valueClass="text-rust" />
          <div className="border-t border-hairline" />
          <Row dotClass="bg-ink" label="Savings rate" value={`${savingsRate}%`} valueClass="text-ink" />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-ink-2 mb-3">{breakdownTitle}</h2>
        {cats.length === 0 ? (
          <p className="text-sm text-muted">No categorized activity in this range.</p>
        ) : (
          <div className="space-y-3">
            {cats.slice(0, 8).map((c) => {
              const pct = denom > 0 ? Math.round((c.total / denom) * 100) : 0
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-base w-5 text-center shrink-0">{c.icon}</span>
                  <span className="text-sm text-ink truncate flex-1 min-w-0">{c.name}</span>
                  <div className="hidden sm:block w-16 h-1.5 bg-sand rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                  </div>
                  <span className="text-sm font-semibold text-ink amount text-right shrink-0">
                    {formatValue(c.total)}
                    {/* In privacy mode formatValue already returns a %, so the
                        explicit share would be a confusing second percentage. */}
                    {!hidden && <span className="text-muted font-normal"> ({pct}%)</span>}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function Row({ dotClass, label, value, valueClass }: { dotClass: string; label: string; value: string; valueClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className="text-sm text-ink">{label}</span>
      <span className={`ml-auto text-sm font-semibold amount ${valueClass}`}>{value}</span>
    </div>
  )
}
