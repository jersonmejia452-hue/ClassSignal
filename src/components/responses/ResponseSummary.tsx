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
        <div>
          <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
            Pulso de la clase
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950" id="summary-title">
            Comprensión en tiempo real
          </h2>
        </div>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <UsersRound className="size-4" aria-hidden="true" />
          {responses.length} {responses.length === 1 ? 'respuesta' : 'respuestas'}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {summary.map((item) => {
          const styles = statusStyles[item.status]
          const Icon = styles.icon

          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.status}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn('grid size-10 place-items-center rounded-xl', styles.color)}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-2xl font-black tracking-tight text-slate-950">
                  {item.percentage}%
                </span>
              </div>
              <p className="mt-4 text-sm font-extrabold text-slate-800">
                {statusContent[item.status].shortLabel}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {item.count} {item.count === 1 ? 'estudiante' : 'estudiantes'}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
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
