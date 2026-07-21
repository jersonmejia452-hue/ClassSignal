import {
  BrainCircuit,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Gauge,
  History,
  Lightbulb,
  RefreshCw,
  Sparkles,
  UsersRound,
} from 'lucide-react'

import { cn } from '../../lib/cn'
import {
  formatCompactNumber,
  formatDateTime,
  formatDuration,
  formatEstimatedUsd,
} from '../../lib/format'
import { analysisPendingTimeoutMs } from '../../types/domain'
import type {
  AnalysisSeverity,
  ConfusionLevel,
  RecommendationPriority,
  SessionAnalysis,
} from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

interface ConfusionMapPanelProps {
  analyses: SessionAnalysis[]
  latestRun: SessionAnalysis | null
  analysis: SessionAnalysis | null
  responseCount: number
  latestResponseAt: string | null
  responsesReady: boolean
  isLoading: boolean
  isAnalyzing: boolean
  error: string | null
  onAnalyze: () => Promise<void>
  onPrepareIntervention?: (conceptIndex: number) => unknown | Promise<unknown>
  preparingConceptIndex?: number | null
  selectedConceptIndex?: number | null
  interventionDisabled?: boolean
}

const levelContent: Record<ConfusionLevel, { label: string; className: string }> = {
  low: { label: 'Baja', className: 'bg-emerald-50 text-emerald-800' },
  medium: { label: 'Media', className: 'bg-amber-50 text-amber-800' },
  high: { label: 'Alta', className: 'bg-orange-50 text-orange-800' },
  critical: { label: 'Crítica', className: 'bg-red-50 text-red-800' },
}

const severityContent: Record<AnalysisSeverity, { label: string; className: string }> = {
  low: { label: 'Leve', className: 'bg-blue-50 text-blue-800' },
  medium: { label: 'Media', className: 'bg-amber-50 text-amber-800' },
  high: { label: 'Alta', className: 'bg-red-50 text-red-800' },
}

const priorityContent: Record<RecommendationPriority, string> = {
  now: 'Ahora',
  next: 'Siguiente',
  later: 'Después',
}

const runStatusLabels = {
  pending: 'En curso',
  completed: 'Completado',
  failed: 'Falló',
} as const

function representsSameInstant(first: string, second: string | null) {
  if (!second) return false
  return Date.parse(first) === Date.parse(second)
}

export function ConfusionMapPanel({
  analyses,
  latestRun,
  analysis,
  responseCount,
  latestResponseAt,
  responsesReady,
  isLoading,
  isAnalyzing,
  error,
  onAnalyze,
  onPrepareIntervention,
  preparingConceptIndex = null,
  selectedConceptIndex = null,
  interventionDisabled: interventionExternallyDisabled = false,
}: ConfusionMapPanelProps) {
  const map = analysis?.result ?? null
  const isPending = latestRun?.status === 'pending'
    && Date.now() - Date.parse(latestRun.created_at) < analysisPendingTimeoutMs
  const isBusy = isAnalyzing || isPending
  const isOutdated = Boolean(
    analysis
    && responsesReady
    && (
      analysis.response_count !== responseCount
      || !representsSameInstant(analysis.source_latest_response_at, latestResponseAt)
    ),
  )
  const buttonLabel = !responsesReady
    ? 'Esperando respuestas'
    : map
      ? (isOutdated ? 'Actualizar mapa' : 'Mapa actualizado')
      : 'Analizar pulso'
  const previousRuns = analysis
    ? analyses.filter((item) => item.id !== analysis.id)
    : analyses

  return (
    <section aria-labelledby="confusion-map-title">
      <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.13em] text-blue-300 uppercase">
              <Sparkles className="size-4" aria-hidden="true" />
              Lectura colectiva con GPT‑5.6
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight" id="confusion-map-title">
              Mapa de confusión
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Agrupa las señales anónimas por concepto y propone próximos pasos para la clase. El resultado es una orientación docente, no una calificación.
            </p>
          </div>

          <Button
            className="w-full shrink-0 sm:w-auto"
            disabled={!responsesReady || responseCount === 0 || isPending || Boolean(map && !isOutdated)}
            isLoading={isAnalyzing}
            onClick={() => void onAnalyze()}
          >
            {!isAnalyzing && (map && isOutdated ? (
              <RefreshCw className="size-4" aria-hidden="true" />
            ) : (
              <BrainCircuit className="size-4" aria-hidden="true" />
            ))}
            {isPending && !isAnalyzing ? 'Análisis en curso' : buttonLabel}
          </Button>
        </div>

        {responsesReady && responseCount === 0 && (
          <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            El mapa estará disponible cuando llegue la primera respuesta estudiantil.
          </p>
        )}
        {isOutdated && !isBusy && (
          <p className="mt-5 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            Llegaron respuestas nuevas. El mapa visible corresponde a una versión anterior de este pulso.
          </p>
        )}
        {isBusy && map && (
          <p className="mt-5 rounded-xl border border-blue-700/60 bg-blue-950/50 px-4 py-3 text-sm text-blue-100" role="status">
            Estamos preparando una versión actualizada. Puedes seguir consultando el mapa anterior.
          </p>
        )}
      </div>

      {error && <Alert className="mt-4" tone="error">{error}</Alert>}
      {latestRun?.status === 'failed' && latestRun.error_message && !error && (
        <Alert className="mt-4" tone="error" title="El último análisis no terminó">
          {latestRun.error_message}
        </Alert>
      )}

      {isLoading && analyses.length === 0 ? (
        <div className="mt-4 space-y-3" aria-label="Cargando mapa de confusión" role="status">
          <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : map && analysis ? (
        <div className="mt-4 space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={cn('inline-flex min-h-8 items-center rounded-full px-3 text-xs font-extrabold', levelContent[map.confusion_level].className)}>
                Confusión {levelContent[map.confusion_level].label.toLowerCase()}
              </span>
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Clock3 className="size-4" aria-hidden="true" />
                {formatDateTime(analysis.completed_at ?? analysis.created_at)}
              </p>
            </div>
            <p className="mt-4 text-base leading-7 font-semibold text-slate-800">
              {map.overview}
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <UsersRound className="size-4" aria-hidden="true" />
              Basado en {analysis.response_count} {analysis.response_count === 1 ? 'respuesta' : 'respuestas'} · {analysis.model}
            </p>
            {(analysis.total_tokens !== null || analysis.estimated_cost_usd !== null || analysis.duration_ms !== null) && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500" aria-label="Uso del análisis">
                {analysis.total_tokens !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="size-4" aria-hidden="true" />
                    {formatCompactNumber(analysis.total_tokens)} tokens
                  </span>
                )}
                {analysis.estimated_cost_usd !== null && (
                  <span className="inline-flex items-center gap-1.5" title="Estimación según los precios de Luna vigentes al ejecutar el análisis">
                    <CircleDollarSign className="size-4" aria-hidden="true" />
                    ~{formatEstimatedUsd(analysis.estimated_cost_usd)}
                  </span>
                )}
                {analysis.duration_ms !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-4" aria-hidden="true" />
                    {formatDuration(analysis.duration_ms)}
                  </span>
                )}
              </div>
            )}
          </article>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
                  Conceptos a revisar
                </p>
                <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">
                  Dónde se concentra la confusión
                </h3>
              </div>

              {map.concepts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
                  No se detectó un foco de confusión suficientemente consistente. Conviene consolidar el tema y mantener abierto el canal de dudas.
                </div>
              ) : map.concepts.map((concept, conceptIndex) => {
                const severity = severityContent[concept.severity]
                const isPreparingThisConcept = preparingConceptIndex === conceptIndex
                const interventionDisabled = isOutdated
                  || isBusy
                  || isLoading
                  || interventionExternallyDisabled
                return (
                  <article
                    className={cn(
                      'rounded-2xl border bg-white p-5 shadow-sm',
                      selectedConceptIndex === conceptIndex
                        ? 'border-blue-300 ring-2 ring-blue-100'
                        : 'border-slate-200',
                    )}
                    key={`${concept.concept}-${concept.explanation}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className={cn('inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-extrabold', severity.className)}>
                          Prioridad {severity.label.toLowerCase()}
                        </span>
                        <h4 className="mt-3 text-lg font-extrabold tracking-tight text-slate-950">
                          {concept.concept}
                        </h4>
                      </div>
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                        {concept.affected_students} {concept.affected_students === 1 ? 'señal' : 'señales'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {concept.explanation}
                    </p>
                    {concept.evidence.length > 0 && (
                      <ul className="mt-4 space-y-2 border-l-2 border-blue-200 pl-4" aria-label={`Evidencia para ${concept.concept}`}>
                        {concept.evidence.map((evidence, index) => (
                          <li className="text-sm leading-6 text-slate-600" key={`${evidence}-${index}`}>
                            “{evidence}”
                          </li>
                        ))}
                      </ul>
                    )}
                    {onPrepareIntervention && (
                      <Button
                        aria-label={`Preparar intervención para ${concept.concept}`}
                        className="mt-5 w-full sm:w-auto"
                        disabled={interventionDisabled}
                        isLoading={isPreparingThisConcept}
                        onClick={() => void onPrepareIntervention(conceptIndex)}
                        variant="secondary"
                      >
                        {!isPreparingThisConcept && (
                          <Sparkles className="size-4" aria-hidden="true" />
                        )}
                        {isPreparingThisConcept ? 'Preparando intervención' : 'Preparar intervención'}
                      </Button>
                    )}
                  </article>
                )
              })}
            </div>

            <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6" aria-labelledby="recommendations-title">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white">
                <Lightbulb className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950" id="recommendations-title">
                Próximos pasos
              </h3>
              {map.recommendations.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  No hay recomendaciones adicionales para esta lectura.
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {map.recommendations.map((recommendation, index) => (
                    <li className="rounded-xl border border-blue-100 bg-white p-4" key={`${recommendation.title}-${index}`}>
                      <p className="text-xs font-extrabold tracking-wide text-blue-700 uppercase">
                        {priorityContent[recommendation.priority]}
                      </p>
                      <p className="mt-1 font-extrabold text-slate-900">{recommendation.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{recommendation.action}</p>
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            El mapa fue generado por IA a partir de respuestas anónimas. Contrasta sus conclusiones con las respuestas originales antes de tomar decisiones pedagógicas.
          </p>
        </div>
      ) : !isBusy && responsesReady && responseCount > 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <BrainCircuit className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-extrabold tracking-tight text-slate-950">
            Las respuestas están listas para analizar
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            El análisis se ejecuta solo cuando tú lo solicitas. No se envían correos, identificadores anónimos ni datos de la cuenta docente a OpenAI.
          </p>
        </div>
      ) : null}

      {previousRuns.length > 0 && (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <span className="flex items-center gap-2">
              <History className="size-4" aria-hidden="true" />
              Historial ({previousRuns.length})
            </span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </summary>
          <ul className="border-t border-slate-100 px-4 py-2">
            {previousRuns.slice(0, 8).map((run) => (
              <li className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3 text-sm last:border-0" key={run.id}>
                <span className="font-semibold text-slate-700">
                  {formatDateTime(run.completed_at ?? run.created_at)}
                </span>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-extrabold',
                  run.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-800'
                    : run.status === 'failed'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-amber-50 text-amber-800',
                )}>
                  {runStatusLabels[run.status]} · {run.response_count} respuestas
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
