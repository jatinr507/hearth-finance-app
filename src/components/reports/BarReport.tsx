import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface IncomeExpenseMonth {
  month: string
  label: string
  income: number
  spending: number
}

interface BarReportProps {
  data: IncomeExpenseMonth[]
  formatValue: (value: number) => string
}

// Income vs. spending grouped bars, one pair per month.
export function BarReport({ data, formatValue }: BarReportProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} barGap={4}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A7F6D' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          formatter={(v, name) => [formatValue(v as number), name === 'income' ? 'Income' : 'Spending']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2D9CA', backgroundColor: '#FBF8F2' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="income" name="Income" fill="#7C8A5A" radius={[4, 4, 0, 0]} />
        <Bar dataKey="spending" name="Spending" fill="#B4502F" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
