import { toPng } from 'html-to-image'
import Papa from 'papaparse'

// All exports are explicit, user-initiated, fully on-device — no network.

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Render a DOM node (the chart container) to a PNG and download it.
export async function downloadPng(node: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(node, {
    backgroundColor: '#FBF8F2', // --color-surface, so the export isn't transparent
    pixelRatio: 2,
  })
  triggerDownload(dataUrl, filename)
}

// Serialize aggregated rows to CSV and download.
export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  URL.revokeObjectURL(url)
}
