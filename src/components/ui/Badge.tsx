import { cn } from '@/lib/utils'

interface BadgeProps {
  label: string
  color?: string
  className?: string
}

export function Badge({ label, color = '#BE6E46', className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-medium', className)}
      style={{ backgroundColor: `${color}26`, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}
