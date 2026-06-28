import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-clay text-on-ink hover:bg-clay/90 active:bg-clay/80': variant === 'primary',
          'bg-transparent border border-hairline text-ink-2 hover:bg-sand': variant === 'secondary',
          'text-clay hover:bg-tint-clay': variant === 'ghost',
          'bg-rust text-on-ink hover:bg-rust/90': variant === 'destructive',
        },
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2.5 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
