import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3 } from 'lucide-react'

import { buildCollectiveCycleComparison } from '../../lib/collectiveCycle'
import { cn } from '../../lib/cn'
import { statusContent } from '../../lib/format'
import type { StudentResponse, UnderstandingStatus } from '../../types/domain'

interface InterventionCycleResultPanelProps {
  afterOrdinal: number
  afterResponses: StudentResponse[]
  beforeOrdinal: number
  beforeResponses: StudentResponse[]
  isAfterPulseActive: boolean
}

const statusOrder: UnderstandingStatus[] = ['understood', 'question', 'lost']

const outcomeCopy = {
  improved: 'La señal colectiva mejoró en el siguiente pulso.',
  stable: 'La distribución colectiva se mantuvo en el siguiente pulso.',
  follow_up: 'La señal colectiva requiere seguimiento en el siguiente pulso.',
  neutral: 'Aún no hay respuestas suficientes para comparar ambos pulsos.',
} as const

export function InterventionCycleResultPanel({
  afterOrdinal,
  afterResponses,
  beforeOrdinal,
  beforeResponses,
  isAfterPulseActive,
}: InterventionCycleResultPanelProps) {
  const comparison = buildCollectiveCycleComparison(beforeResponses, afterResponses)

  return (
    <section
      aria-labelledby="intervention-cycle-result-title"
      className="mt-5 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold tracking-[0.13em] text-teal-700 uppercase">
            Comparación colectiva
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950" id="intervention-cycle-result-title">
            Resultado del siguiente pulso
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Pulso {beforeOrdinal} frente al pulso {afterOrdinal}. Se comparan distribuciones agregadas; no se emparejan ni siguen estudiantes entre mediciones.
          </p>
        </div>
        {isAfterPulseActive && (
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-xs font-extrabold text-amber-800">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Resultado provisional
          </span>
        )}
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700" aria-live="polite">
        {beforeResponses.length} {beforeResponses.length === 1 ? 'respuesta' : 'respuestas'} antes ·{' '}
        {afterResponses.length} {afterResponses.length === 1 ? 'respuesta' : 'respuestas'} después.{' '}
        Estos conteos usan denominadores separados.
      </p>

      {comparison.state === 'waiting' ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="font-black text-slate-900">Esperando respuestas del siguiente pulso</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Los cambios aparecerán cuando llegue la primera señal del pulso {afterOrdinal}.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {statusOrder.map((status) => {
              const before = comparison.before.percentages[status]
              const after = comparison.after.percentages[status]
              const delta = comparison.deltaPercentagePoints[status] ?? 0
              const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight
              const isFavorable = status === 'understood' ? delta >= 0 : delta <= 0

              return (
                <article className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={status}>
                  <p className="text-sm font-extrabold text-slate-800">{statusContent[status].shortLabel}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{before}% → {after}%</p>
                  <span className={cn(
                    'mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold',
                    delta === 0
                      ? 'bg-slate-200 text-slate-700'
                      : isFavorable
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800',
                  )}>
                    <Icon className="size-3.5" aria-hidden="true" />
                    {delta > 0 ? '+' : ''}{delta} pp
                  </span>
                </article>
              )
            })}
          </div>
          <p className={cn(
            'mt-4 rounded-xl px-4 py-3 text-sm font-extrabold',
            comparison.outcome === 'improved'
              ? 'bg-emerald-50 text-emerald-900'
              : comparison.outcome === 'stable'
                ? 'bg-blue-50 text-blue-900'
                : 'bg-amber-50 text-amber-950',
          )}>
            {outcomeCopy[comparison.outcome]}
          </p>
        </>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        La secuencia temporal no demuestra que la actividad haya causado el cambio. Usa este resultado como orientación docente junto con el contexto de la clase.
      </p>
    </section>
  )
}
