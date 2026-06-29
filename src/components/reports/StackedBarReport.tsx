import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts'
import type { StackedMonth, CategoryTotal } from '@/lib/reportAggregations'

interface StackedBarReportProps {
  rows: StackedMonth[]
  categories: CategoryTotal[]
  formatValue: (value: number) => string
  height?: number
}

// Spending by category over months, stacked. One bar segment per top category.
export function StackedBarReport({ rows, categories, formatValue, height = 360 }: StackedBarReportProps) {
  if (categories.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted">
        No categorized spending in this range yet.
      </div>
    )
  }
  const meta = new Map(categories.map((c) => [c.id, c]))
  const grandTotal = categories.reduce((s, c) => s + c.total, 0)
  // Label only segments tall enough to fit text, to avoid clutter on thin slices.
  const renderSegmentLabel = (props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string }) => {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const width = Number(props.width ?? 0)
    const h = Number(props.height ?? 0)
    const value = Number(props.value ?? 0)
    if (!value || h < 16) return null
    return (
      <text x={x + width / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={600} fill="#FBF8F2">
        {formatValue(value)}
      </text>
    )
  }
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A7F6D' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(v, name) => [formatValue(v as number), meta.get(name as string)?.name ?? name]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2D9CA', backgroundColor: '#FBF8F2' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            formatter={(value) => {
              const c = meta.get(value as string)
              if (!c) return value
              const pct = grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0
              return `${c.icon} ${c.name} · ${formatValue(c.total)} (${pct}%)`
            }}
          />
          {categories.map((c) => (
            <Bar key={c.id} dataKey={c.id} name={c.id} stackId="spend" fill={c.color} radius={[2, 2, 0, 0]}>
              <LabelList dataKey={c.id} content={renderSegmentLabel} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
