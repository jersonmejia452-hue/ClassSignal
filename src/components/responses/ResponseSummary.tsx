import { CircleHelp, SearchX, ThumbsUp, UsersRound } from 'lucide-react'

import { cn } from '../../lib/cn'
import { buildStatusSummary, statusContent } from '../../lib/format'
import type { StudentResponse, UnderstandingStatus } from '../../types/domain'

const statusStyles: Record<
  UnderstandingStatus,
  { icon: typeof ThumbsUp; color: string; bar: string }
> = {
  understood: {
    icon: ThumbsUp,
    color: 'bg-emerald-50 text-emerald-700',
    bar: 'bg-emerald-500',
  },
  question: {
    icon: CircleHelp,
    color: 'bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
  },
  lost: {
    icon: SearchX,
    color: 'bg-red-50 text-red-700',
    bar: 'bg-red-500',
  },
}

export function ResponseSummary({ responses }: { responses: StudentResponse[] }) {
  const summary = buildStatusSummary(responses)

  return (
    <section aria-labelledby="summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-950" id="summary-title">
          Comprensión en vivo
        </h2>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <UsersRound className="size-4" aria-hidden="true" />
          {responses.length} {responses.length === 1 ? 'respuesta' : 'respuestas'}
        </p>
      </div>

      <div className="mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-3">
        {summary.map((item) => {
          const styles = statusStyles[item.status]
          const Icon = styles.icon

          return (
            <article className="border-b border-slate-100 p-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0" key={item.status}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', styles.color)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-800">
                      {statusContent[item.status].shortLabel}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.count} {item.count === 1 ? 'estudiante' : 'estudiantes'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xl font-black tracking-tight text-slate-950">
                  {item.percentage}%
                </span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-500', styles.bar)}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
