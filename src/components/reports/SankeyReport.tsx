import { useEffect, useRef, useState } from 'react'
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyJustify,
  type SankeyNode,
  type SankeyLink as D3SankeyLink,
} from 'd3-sankey'
import type { SankeyData, SankeyNodeDatum } from '@/lib/reportAggregations'

interface SankeyReportProps {
  data: SankeyData
  // Format a flow value for labels (currency, or a percentage in privacy mode).
  formatValue: (value: number) => string
  height?: number
}

const CASH_COLOR = '#BE6E46'

type NodeExtra = SankeyNodeDatum
type LinkExtra = { value: number }
type LaidOutNode = SankeyNode<NodeExtra, LinkExtra>
type LaidOutLink = D3SankeyLink<NodeExtra, LinkExtra>

function SankeyChart({
  width,
  height,
  data,
  formatValue,
}: {
  width: number
  height: number
  data: SankeyData
  formatValue: (value: number) => string
}) {
  // Room in the margins for the value labels that sit outside the end nodes.
  const M = { top: 18, right: 130, bottom: 18, left: 116 }
  if (width <= 0 || height <= 0) return null

  // d3-sankey mutates the arrays it's given, so hand it fresh copies.
  const layout = sankey<NodeExtra, LinkExtra>()
    .nodeWidth(14)
    .nodePadding(26)
    .nodeAlign(sankeyJustify)
    .extent([
      [M.left, M.top],
      [width - M.right, height - M.bottom],
    ])

  const graph = layout({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  })

  const sideTotal = (side?: string) =>
    side === 'income' || side === 'savings' ? data.incomeTotal : side === 'expense' ? data.expenseTotal : 0
  const linkPath = sankeyLinkHorizontal<NodeExtra, LinkExtra>()

  return (
    <svg width={width} height={height}>
      <defs>
        {graph.links.map((link, i) => {
          const s = link.source as LaidOutNode
          const t = link.target as LaidOutNode
          return (
            <linearGradient
              key={i}
              id={`sankey-link-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={s.x1 ?? 0}
              x2={t.x0 ?? 0}
            >
              <stop offset="0%" stopColor={s.color ?? CASH_COLOR} />
              <stop offset="100%" stopColor={t.color ?? CASH_COLOR} />
            </linearGradient>
          )
        })}
      </defs>

      {/* Ribbons */}
      {graph.links.map((link, i) => (
        <path
          key={i}
          d={linkPath(link as LaidOutLink) ?? undefined}
          fill="none"
          stroke={`url(#sankey-link-${i})`}
          strokeWidth={Math.max(1, link.width ?? 0)}
          strokeOpacity={0.5}
        />
      ))}

      {/* Nodes + labels */}
      {graph.nodes.map((node, i) => {
        const n = node as LaidOutNode
        const x0 = n.x0 ?? 0
        const x1 = n.x1 ?? 0
        const y0 = n.y0 ?? 0
        const y1 = n.y1 ?? 0
        const midY = (y0 + y1) / 2
        const isHub = n.side === 'cash'
        const isRight = (x0 + x1) / 2 > width / 2
        const total = sideTotal(n.side)
        const pct = total > 0 ? Math.round(((n.value ?? 0) / total) * 100) : null

        // Hub label sits centered on the node; others sit just outside, on the
        // side the node lives on, so they never overlap the ribbons.
        const labelX = isHub ? (x0 + x1) / 2 : isRight ? x1 + 8 : x0 - 8
        const anchor: 'start' | 'middle' | 'end' = isHub ? 'middle' : isRight ? 'start' : 'end'

        return (
          <g key={i}>
            <rect x={x0} y={y0} width={Math.max(1, x1 - x0)} height={Math.max(1, y1 - y0)} rx={3} fill={n.color ?? CASH_COLOR} fillOpacity={0.95} />
            <text
              x={labelX}
              y={isHub ? midY : midY - 7}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={600}
              fill="#2B2620"
            >
              {n.icon ? `${n.icon} ` : ''}
              {n.name}
            </text>
            {!isHub && (
              <text x={labelX} y={midY + 8} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="#8A7F6D">
                {formatValue(n.value ?? 0)}
                {pct != null ? ` (${pct}%)` : ''}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function SankeyReport({ data, formatValue, height = 420 }: SankeyReportProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  if (data.links.length === 0) {
    return <EmptyState />
  }
  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 && <SankeyChart width={width} height={height} data={data} formatValue={formatValue} />}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-muted">
      No categorized income or spending in this range yet.
    </div>
  )
}
