import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-surface rounded-md shadow-card border border-hairline p-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}
