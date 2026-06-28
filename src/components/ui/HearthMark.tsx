interface HearthMarkProps {
  size?: number
  className?: string
  bgColor?: string
}

export function HearthMark({ size = 32, className, bgColor = '#EFE7DA' }: HearthMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer clay circle */}
      <circle cx="16" cy="16" r="16" fill="#BE6E46" />
      {/* Offset inner cutout — creates the crescent */}
      <circle cx="22" cy="16" r="9" fill={bgColor} />
    </svg>
  )
}
