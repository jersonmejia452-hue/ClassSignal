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
      aria-label="ClassSignal, inicio"
    >
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center overflow-hidden rounded-[0.9rem] border shadow-sm',
          inverse
            ? 'border-white/15 bg-white'
            : 'border-slate-200 bg-white',
        )}
        aria-hidden="true"
      >
        <img
          alt=""
          className="size-full object-cover"
          height="44"
          src="/brand/classsignal-mark.png"
          width="44"
        />
      </span>
      {!compact && (
        <span className="leading-none">
          <span
            className={cn(
              'block text-[1.05rem] font-extrabold tracking-[-0.025em]',
              inverse ? 'text-white' : 'text-slate-950',
            )}
          >
            Class<span className={inverse ? 'text-[#66e2d1]' : 'text-blue-600'}>Signal</span>
          </span>
          <span
            className={cn(
              'mt-1 block text-[0.68rem] font-bold tracking-[0.13em] uppercase',
              inverse ? 'text-blue-100' : 'text-slate-500',
            )}
          >
            La clase también habla
          </span>
        </span>
      )}
    </Link>
  )
}
