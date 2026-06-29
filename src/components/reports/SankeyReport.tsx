import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts'
import type { SankeyData } from '@/lib/reportAggregations'

interface SankeyReportProps {
  data: SankeyData
  // Format a flow value for tooltips (currency or percentage in privacy mode).
  formatValue: (value: number) => string
}

// Custom node renderer so each category keeps its own color + label.
function SankeyNode(props: {
  x: number
  y: number
  width: number
  height: number
  index: number
  payload: { name: string; color?: string; value: number }
  containerWidth: number
}) {
  const { x, y, width, height, payload, containerWidth } = props
  const isRight = x + width / 2 > containerWidth / 2
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={payload.color ?? '#BE6E46'} fillOpacity={0.9} radius={2} />
      <text
        x={isRight ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isRight ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={11}
        fill="#6F6657"
      >
        {payload.name}
      </text>
    </Layer>
  )
}

export function SankeyReport({ data, formatValue }: SankeyReportProps) {
  if (data.links.length === 0) {
    return <EmptyState />
  }
  return (
    <ResponsiveContainer width="100%" height={420}>
      <Sankey
        data={data}
        nodePadding={24}
        nodeWidth={12}
        margin={{ top: 10, right: 90, bottom: 10, left: 90 }}
        link={{ stroke: '#C9BBA6', strokeOpacity: 0.4 }}
        node={<SankeyNode x={0} y={0} width={0} height={0} index={0} payload={{ name: '', value: 0 }} containerWidth={0} />}
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
