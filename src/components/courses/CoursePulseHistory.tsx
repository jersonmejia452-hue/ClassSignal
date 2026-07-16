import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Minus,
  RadioTower,
  TrendingUp,
  UsersRound,
} from 'lucide-react'

import {
  buildCoursePulseMetrics,
  getCoursePulseDistribution,
} from '../../lib/coursePulse'
import { formatDateTime } from '../../lib/format'
import type { CoursePulsePoint } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { EmptyState } from '../ui/EmptyState'

interface CoursePulseHistoryProps {
  points: readonly CoursePulsePoint[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

const trendContent = {
  up: {
    icon: ArrowUpRight,
    className: 'text-emerald-700',
    label: 'Mejoró',
  },
  down: {
    icon: ArrowDownRight,
    className: 'text-red-700',
    label: 'Bajó',
  },
  stable: {
    icon: Minus,
    className: 'text-slate-600',
    label: 'Se mantuvo',
  },
} as const

function PulseLoadingState() {
  return (
    <section aria-label="Cargando evolución del curso" role="status">
      <div className="h-7 w-64 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" key={index} />
        ))}
      </div>
      <div className="mt-4 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </section>
  )
}

export function CoursePulseHistory({
  points,
  isLoading = false,
  error = null,
  onRetry,
}: CoursePulseHistoryProps) {
  if (isLoading && points.length === 0) {
    return <PulseLoadingState />
  }

  if (error && points.length === 0) {
    return (
      <Alert title="No pudimos cargar la evolución" tone="error">
        {error}
        {onRetry && (
          <button
            className="ml-1 font-extrabold underline underline-offset-2"
            disabled={isLoading}
            onClick={onRetry}
            type="button"
          >
            {isLoading ? 'Actualizando…' : 'Reintentar'}
          </button>
        )}
      </Alert>
    )
  }

  if (points.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-5" aria-hidden="true" />}
        title="Aún no hay clases para comparar"
      >
        Cuando el curso tenga clases, aquí podrás seguir cómo cambia la comprensión del grupo.
      </EmptyState>
    )
  }

  const orderedPoints = [...points].sort((first, second) => (
    Date.parse(first.created_at) - Date.parse(second.created_at)
  ))
  const metrics = buildCoursePulseMetrics(orderedPoints)

  if (metrics.measuredSessions === 0) {
    return (
      <div>
        {error && (
          <Alert className="mb-4" title="No pudimos actualizar el pulso" tone="error">
            {error}
            {onRetry && (
              <button
                className="ml-1 font-extrabold underline underline-offset-2"
                disabled={isLoading}
                onClick={onRetry}
                type="button"
              >
                {isLoading ? 'Actualizando…' : 'Reintentar'}
              </button>
            )}
          </Alert>
        )}
        <EmptyState
          icon={<Activity className="size-5" aria-hidden="true" />}
          title="Las clases todavía no tienen señales"
        >
          El pulso histórico aparecerá cuando llegue la primera respuesta estudiantil.
        </EmptyState>
      </div>
    )
  }

  const trend = metrics.trend ? trendContent[metrics.trend] : null
  const TrendIcon = trend?.icon

  return (
    <section
      aria-busy={isLoading || undefined}
      aria-labelledby="course-pulse-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
            Pulso histórico
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]" id="course-pulse-title">
            Evolución de la comprensión
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          {isLoading && (
            <span className="inline-flex items-center gap-1.5" role="status">
              <span className="size-2 animate-pulse rounded-full bg-blue-600" aria-hidden="true" />
              Actualizando
            </span>
          )}
          <span>
            Últimas {orderedPoints.length} {orderedPoints.length === 1 ? 'clase' : 'clases'}
          </span>
        </div>
      </div>

      {error && (
        <Alert className="mt-5" title="Mostramos el último pulso disponible" tone="error">
          {error}
          {onRetry && (
            <button
              className="ml-1 font-extrabold underline underline-offset-2"
              disabled={isLoading}
              onClick={onRetry}
              type="button"
            >
              {isLoading ? 'Actualizando…' : 'Reintentar'}
            </button>
          )}
        </Alert>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Activity className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-black text-slate-950">
            {metrics.measuredSessions}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {metrics.measuredSessions === 1 ? 'clase medida' : 'clases medidas'}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-black text-slate-950">
            {metrics.totalResponses}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-600">
            respuestas acumuladas
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <TrendingUp className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-black text-slate-950">
            {metrics.weightedDistribution.understood}%
          </p>
          <p className="mt-1 text-sm font-bold text-slate-600">
            comprensión ponderada
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <RadioTower className="size-5" aria-hidden="true" />
          </span>
          {trend && TrendIcon && metrics.trendDelta !== null ? (
            <>
              <p className={`mt-4 flex items-center gap-1 text-2xl font-black ${trend.className}`}>
                <TrendIcon className="size-5" aria-hidden="true" />
                {metrics.trendDelta > 0 ? '+' : ''}{metrics.trendDelta} pp
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {trend.label} frente a la clase anterior
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-2xl font-black text-slate-950">
                {metrics.latestUnderstoodPercentage}%
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                Se necesita otra medición para comparar
              </p>
            </>
          )}
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-600" aria-label="Leyenda del pulso">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Entendí
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            Tengo una duda
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500" aria-hidden="true" />
            Estoy perdido
          </span>
        </div>

        <ol className="mt-6 space-y-5">
          {orderedPoints.map((point) => {
            const distribution = getCoursePulseDistribution(point)
            const isEmpty = point.response_count === 0

            return (
              <li key={point.session_id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-900">
                      {point.title}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {formatDateTime(point.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {point.is_active && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                        En vivo
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-500">
                      {isEmpty
                        ? 'Sin respuestas'
                        : `${point.response_count} ${point.response_count === 1 ? 'respuesta' : 'respuestas'}`}
                    </span>
                  </div>
                </div>

                {isEmpty ? (
                  <div className="mt-3 h-3 rounded-full bg-slate-100" aria-label={`${point.title}: sin respuestas`} role="img" />
                ) : (
                  <div
                    aria-label={`${point.title}: ${distribution.understood}% entendió, ${distribution.question}% tiene dudas y ${distribution.lost}% está perdido`}
                    className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100"
                    role="img"
                  >
                    <span
                      className="h-full bg-emerald-500"
                      style={{ width: `${(point.understood_count / point.response_count) * 100}%` }}
                    />
                    <span
                      className="h-full bg-amber-500"
                      style={{ width: `${(point.question_count / point.response_count) * 100}%` }}
                    />
                    <span
                      className="h-full bg-red-500"
                      style={{ width: `${(point.lost_count / point.response_count) * 100}%` }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          La comprensión acumulada se pondera por el número de respuestas de cada clase; una clase pequeña no pesa lo mismo que una medición con todo el grupo.
        </p>
      </div>
    </section>
  )
}
