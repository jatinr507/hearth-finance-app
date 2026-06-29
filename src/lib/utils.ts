import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Privacy-aware amount formatter. When `hidden` is false, behaves like
// formatCurrency. When `hidden` is true, renders the value's share of `total`
// as a percentage (e.g. "42%") so charts stay legible without exposing dollars;
// where no meaningful total exists (total is 0/undefined), masks with dots.
export function formatAmount(
  value: number,
  opts: { hidden: boolean; total?: number },
): string {
  if (!opts.hidden) return formatCurrency(value)
  if (opts.total && opts.total !== 0) {
    const pct = Math.round((Math.abs(value) / Math.abs(opts.total)) * 100)
    return `${pct}%`
  }
  return '••••'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Compact relative time, e.g. "just now", "5m ago", "2h ago", "3d ago".
// Falls back to an absolute date past a week.
export function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days <= 7) return `${days}d ago`
  return formatDate(dateStr)
}
