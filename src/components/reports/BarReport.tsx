import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts'

export interface IncomeExpenseMonth {
  month: string
  label: string
  income: number
  spending: number
  net: number
}

interface BarReportProps {
  data: IncomeExpenseMonth[]
  formatValue: (value: number) => string
  height?: number
}

// Income vs. spending grouped bars with a net-cash-flow trendline overlay.
export function BarReport({ data, formatValue, height = 360 }: BarReportProps) {
  const renderLabel = (props: { x?: number | string; y?: number | string; width?: number | string; value?: number | string }) => {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const width = Number(props.width ?? 0)
    const value = Number(props.value ?? 0)
    if (!value) return null
    return (
      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#8A7F6D">
        {formatValue(value)}
      </text>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} barGap={4} margin={{ top: 24, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A7F6D' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          formatter={(v, name) => [formatValue(v as number), name === 'income' ? 'Income' : name === 'spending' ? 'Spending' : 'Net']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2D9CA', backgroundColor: '#FBF8F2' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="income" name="Income" fill="#7C8A5A" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="income" content={renderLabel} />
        </Bar>
        <Bar dataKey="spending" name="Spending" fill="#B4502F" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="spending" content={renderLabel} />
        </Bar>
        <Line type="monotone" dataKey="net" name="Net" stroke="#2B2620" strokeWidth={2} dot={{ r: 3, fill: '#2B2620' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
