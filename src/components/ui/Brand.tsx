import { Link } from 'react-router-dom'

import { cn } from '../../lib/cn'

interface BrandProps {
  compact?: boolean
  to?: string
  inverse?: boolean
}

export function Brand({ compact = false, to = '/', inverse = false }: BrandProps) {
  return (
    <Link
      className={cn(
        'inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4',
        inverse ? 'focus-visible:outline-white' : 'focus-visible:outline-blue-600',
      )}
      to={to}
      aria-label="Aula Clara, inicio"
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl border text-sm font-extrabold tracking-[-0.04em] shadow-sm',
          inverse
            ? 'border-white/20 bg-white text-slate-950'
            : 'border-blue-100 bg-blue-700 text-white',
        )}
        aria-hidden="true"
      >
        AC
      </span>
      {!compact && (
        <span className="leading-none">
          <span
            className={cn(
              'block text-[1.05rem] font-extrabold tracking-[-0.025em]',
              inverse ? 'text-white' : 'text-slate-950',
            )}
          >
            Aula Clara
          </span>
          <span
            className={cn(
              'mt-1 block text-[0.68rem] font-bold tracking-[0.13em] uppercase',
              inverse ? 'text-blue-100' : 'text-slate-500',
            )}
          >
            Señales para enseñar mejor
          </span>
        </span>
      )}
    </Link>
  )
}
