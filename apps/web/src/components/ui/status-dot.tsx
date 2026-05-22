import { cn } from '@/lib/utils'

const colorMap = {
  green: 'bg-green-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
} as const

interface StatusDotProps {
  color: keyof typeof colorMap
  className?: string
}

export function StatusDot({ color, className }: StatusDotProps) {
  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 rounded-full', colorMap[color], className)}
    />
  )
}
