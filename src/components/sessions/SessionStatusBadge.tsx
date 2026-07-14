import { cn } from '../../lib/cn'

export function SessionStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold',
        isActive
          ? 'bg-emerald-50 text-emerald-800'
          : 'bg-slate-100 text-slate-600',
      )}
    >
      <span
        className={cn('size-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-slate-400')}
        aria-hidden="true"
      />
      {isActive ? 'Activa' : 'Finalizada'}
    </span>
  )
}
