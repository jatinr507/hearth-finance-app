import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { StackedMonth, CategoryTotal } from '@/lib/reportAggregations'

interface StackedBarReportProps {
  rows: StackedMonth[]
  categories: CategoryTotal[]
  formatValue: (value: number) => string
}

// Spending by category over months, stacked. One bar segment per top category.
export function StackedBarReport({ rows, categories, formatValue }: StackedBarReportProps) {
  if (categories.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted">
        No categorized spending in this range yet.
      </div>
    )
  }
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A7F6D' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          formatter={(v, name) => [formatValue(v as number), nameById.get(name as string) ?? name]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2D9CA', backgroundColor: '#FBF8F2' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" formatter={(value) => nameById.get(value as string) ?? value} />
        {categories.map((c) => (
          <Bar key={c.id} dataKey={c.id} name={c.id} stackId="spend" fill={c.color} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
