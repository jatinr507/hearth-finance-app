import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts'
import type { SankeyData } from '@/lib/reportAggregations'

interface SankeyReportProps {
  data: SankeyData
  // Format a flow value for labels/tooltips (currency or percentage in privacy mode).
  formatValue: (value: number) => string
  height?: number
}

// Custom node renderer: each category keeps its own color, and the label shows
// the emoji + name with the flow value and its share of that side beneath.
function makeNode(data: SankeyData, formatValue: (v: number) => string) {
  return function SankeyNode(props: {
    x: number
    y: number
    width: number
    height: number
    index: number
    payload: { name: string; color?: string; icon?: string; side?: string; value: number }
    containerWidth: number
  }) {
    const { x, y, width, height, payload, containerWidth } = props
    const isRight = x + width / 2 > containerWidth / 2
    const isCash = payload.side === 'cash'
    const sideTotal = payload.side === 'income' ? data.incomeTotal : payload.side === 'expense' ? data.expenseTotal : 0
    const pct = sideTotal > 0 ? Math.round((payload.value / sideTotal) * 100) : null
    const labelX = isRight ? x - 8 : x + width + 8
    const anchor = isRight ? 'end' : 'start'
    return (
      <Layer>
        <Rectangle x={x} y={y} width={width} height={height} fill={payload.color ?? '#BE6E46'} fillOpacity={0.9} radius={2} />
        <text x={labelX} y={isCash ? y + height / 2 : y + height / 2 - 7} textAnchor={anchor} dominantBaseline="middle" fontSize={12} fontWeight={600} fill="#2B2620">
          {payload.icon ? `${payload.icon} ` : ''}
          {payload.name}
        </text>
        {!isCash && (
          <text x={labelX} y={y + height / 2 + 8} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="#8A7F6D">
            {formatValue(payload.value)}
            {pct != null ? ` (${pct}%)` : ''}
          </text>
        )}
      </Layer>
    )
  }
}

export function SankeyReport({ data, formatValue, height = 420 }: SankeyReportProps) {
  if (data.links.length === 0) {
    return <EmptyState />
  }
  const NodeRenderer = makeNode(data, formatValue)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodePadding={26}
        nodeWidth={12}
        margin={{ top: 16, right: 140, bottom: 16, left: 120 }}
        link={{ stroke: '#C9BBA6', strokeOpacity: 0.4 }}
        node={<NodeRenderer x={0} y={0} width={0} height={0} index={0} payload={{ name: '', value: 0 }} containerWidth={0} />}
      >
        <Tooltip
          formatter={(v) => formatValue(v as number)}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E2D9CA', backgroundColor: '#FBF8F2' }}
        />
      </Sankey>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-muted">
      No categorized income or spending in this range yet.
    </div>
  )
}
