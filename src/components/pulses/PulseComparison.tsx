import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '../../lib/cn'
import { buildStatusSummary, statusContent } from '../../lib/format'
import type { StudentResponse, UnderstandingStatus } from '../../types/domain'

interface PulseComparisonProps {
  currentOrdinal: number
  currentResponses: StudentResponse[]
  previousOrdinal: number
  previousResponses: StudentResponse[]
}

const statusOrder: UnderstandingStatus[] = ['understood', 'question', 'lost']

const deltaStyles: Record<UnderstandingStatus, { positive: string; negative: string }> = {
  understood: {
    positive: 'bg-emerald-50 text-emerald-800',
    negative: 'bg-red-50 text-red-800',
  },
  question: {
    positive: 'bg-amber-50 text-amber-800',
    negative: 'bg-emerald-50 text-emerald-800',
  },
  lost: {
    positive: 'bg-red-50 text-red-800',
    negative: 'bg-emerald-50 text-emerald-800',
  },
}

export function PulseComparison({
  currentOrdinal,
  currentResponses,
  previousOrdinal,
  previousResponses,
}: PulseComparisonProps) {
  if (currentResponses.length === 0 || previousResponses.length === 0) return null

  const currentByStatus = new Map(
    buildStatusSummary(currentResponses).map((item) => [item.status, item]),
  )
  const previousByStatus = new Map(
    buildStatusSummary(previousResponses).map((item) => [item.status, item]),
  )

  return (
    <section
      aria-labelledby="pulse-comparison-title"
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-[0.13em] text-violet-700 uppercase">
            Cambio agregado
          </p>
          <h2
            className="mt-1 text-xl font-extrabold tracking-tight text-slate-950"
            id="pulse-comparison-title"
          >
            Pulso {currentOrdinal} frente al pulso {previousOrdinal}
          </h2>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          Diferencia en puntos porcentuales
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {statusOrder.map((status) => {
          const current = currentByStatus.get(status)?.percentage ?? 0
          const previous = previousByStatus.get(status)?.percentage ?? 0
          const delta = current - previous
          const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight
          const tone = delta > 0
            ? deltaStyles[status].positive
            : delta < 0
              ? deltaStyles[status].negative
              : 'bg-slate-100 text-slate-700'

          return (
            <article className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={status}>
              <p className="text-sm font-extrabold text-slate-800">
                {statusContent[status].shortLabel}
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-2xl font-black tracking-tight text-slate-950">
                  {current}%
                </span>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold', tone)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {delta > 0 ? '+' : ''}{delta} pp
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
