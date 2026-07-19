import { RadioTower } from 'lucide-react'

import { cn } from '../../lib/cn'

interface PulseStatusBadgeProps {
  isActive: boolean
  ordinal: number
  inverse?: boolean
}

export function PulseStatusBadge({
  isActive,
  ordinal,
  inverse = false,
}: PulseStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-extrabold',
        inverse
          ? isActive
            ? 'border-teal-300/20 bg-teal-300/10 text-teal-100'
            : 'border-white/10 bg-white/[0.06] text-slate-300'
          : isActive
            ? 'border-teal-200 bg-teal-50 text-teal-800'
            : 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      <RadioTower
        className={cn('size-3.5', isActive && 'animate-pulse')}
        aria-hidden="true"
      />
      Pulso {ordinal} · {isActive ? 'Activo' : 'Cerrado'}
    </span>
  )
}
