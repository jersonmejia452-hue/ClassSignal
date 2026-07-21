import { useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  History,
  RadioTower,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

import { formatDateTime } from '../../lib/format'
import { formatMicroInterventionForClipboard } from '../../lib/microInterventionClipboard'
import type { MicroInterventionArtifact } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

interface MicroInterventionPanelProps {
  artifact: MicroInterventionArtifact | null
  conceptLabel: string
  error: string | null
  hasTimedOutPending: boolean
  history: MicroInterventionArtifact[]
  inProgress: boolean
  isGenerating: boolean
  isLoading: boolean
  isOutdated: boolean
  lastInvocationWasCached: boolean
  onOpenNextPulse: () => Promise<boolean>
  onRefresh: () => unknown | Promise<unknown>
  onRegenerate: () => unknown | Promise<unknown>
  openDisabledReason: string | null
  openPulseError: string | null
  showOpenPulseAction: boolean
  isOpeningPulse: boolean
}

async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('clipboard_unavailable')
}

export function MicroInterventionPanel({
  artifact,
  conceptLabel,
  error,
  hasTimedOutPending,
  history,
  inProgress,
  isGenerating,
  isLoading,
  isOutdated,
  lastInvocationWasCached,
  onOpenNextPulse,
  onRefresh,
  onRegenerate,
  openDisabledReason,
  openPulseError,
  showOpenPulseAction,
  isOpeningPulse,
}: MicroInterventionPanelProps) {
  const titleId = useId()
  const openButtonId = `${titleId}-open-pulse`
  const confirmationId = `${titleId}-open-confirmation`
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const copyResetTimer = useRef<number | null>(null)
  const previousArtifactId = useRef<string | null>(null)
  const hadConfirmation = useRef(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [isConfirmingPulse, setIsConfirmingPulse] = useState(false)

  useEffect(() => () => {
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current)
  }, [])

  useEffect(() => {
    if (!artifact || previousArtifactId.current === artifact.id) return
    previousArtifactId.current = artifact.id
    titleRef.current?.focus({ preventScroll: true })
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    titleRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [artifact])

  useEffect(() => {
    if (isConfirmingPulse) {
      hadConfirmation.current = true
      document.getElementById(confirmationId)?.focus()
    } else if (hadConfirmation.current) {
      hadConfirmation.current = false
      document.getElementById(openButtonId)?.focus()
    }
  }, [confirmationId, isConfirmingPulse, openButtonId])

  const copyIntervention = async () => {
    if (!artifact?.result) return
    try {
      await writeClipboardText(formatMicroInterventionForClipboard(artifact.result))
      setCopyState('copied')
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current)
      copyResetTimer.current = window.setTimeout(() => {
        setCopyState('idle')
        copyResetTimer.current = null
      }, 2_200)
    } catch {
      setCopyState('error')
    }
  }

  const confirmOpenPulse = async () => {
    const opened = await onOpenNextPulse()
    if (opened) setIsConfirmingPulse(false)
  }

  const result = artifact?.result ?? null
  const previousRuns = artifact
    ? history.filter((item) => item.id !== artifact.id)
    : history

  return (
    <section
      aria-labelledby={titleId}
      className="mt-5 scroll-mt-44 overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm"
    >
      <div className="border-b border-violet-100 bg-violet-50/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.13em] text-violet-700 uppercase">
              <Sparkles className="size-4" aria-hidden="true" />
              Copiloto docente con GPT‑5.6
            </p>
            <h2
              className="mt-2 break-words text-xl font-black tracking-tight text-slate-950 outline-none sm:text-2xl"
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
            >
              Microintervención · {conceptLabel}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Orientación generada por IA para el profesor. Revísala y adáptala al contexto del grupo antes de usarla.
            </p>
          </div>
          {lastInvocationWasCached && (
            <span className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-blue-100 px-3 text-xs font-extrabold text-blue-800" role="status">
              Resultado reutilizado de caché
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isOutdated && (
          <Alert className="mb-4" title="Intervención desactualizada">
            El mapa o sus señales fuente cambiaron. Regenera la intervención antes de usarla como referencia actual.
          </Alert>
        )}
        {hasTimedOutPending && (
          <Alert className="mb-4" title="La generación está tardando demasiado" tone="error">
            Actualiza el historial o vuelve a intentarlo. El servidor evitará trabajos duplicados si la solicitud anterior continúa.
          </Alert>
        )}
        {error && <Alert className="mb-4" tone="error">{error}</Alert>}
        {openPulseError && <Alert className="mb-4" tone="error">{openPulseError}</Alert>}
        {(error || hasTimedOutPending) && (
          <Button
            className="mb-4 w-full sm:w-auto"
            isLoading={isLoading}
            onClick={() => void onRefresh()}
            variant="secondary"
          >
            {!isLoading && <RefreshCw className="size-4" aria-hidden="true" />}
            Revisar estado
          </Button>
        )}

        {(isLoading || isGenerating || (inProgress && !result)) && !result && (
          <div aria-live="polite" className="space-y-3" role="status">
            <p className="font-extrabold text-slate-800">
              {isLoading ? 'Cargando intervención…' : 'Preparando la intervención…'}
            </p>
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        )}

        {inProgress && result && (
          <Alert className="mb-4" title="Preparando una nueva versión">
            Puedes seguir consultando el resultado anterior mientras termina la generación.
          </Alert>
        )}

        {result && artifact && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4" aria-hidden="true" />
                {result.duration_minutes} minutos
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatDateTime(artifact.completed_at ?? artifact.created_at)}</span>
              <span aria-hidden="true">·</span>
              <span>{artifact.model} · esfuerzo {artifact.reasoning_effort}</span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-extrabold tracking-wide text-violet-700 uppercase">Actividad</p>
                <h3 className="mt-2 break-words text-xl font-black text-slate-950">{result.title}</h3>
                <dl className="mt-5 space-y-4 text-sm leading-6">
                  <div>
                    <dt className="font-extrabold text-slate-900">Objetivo</dt>
                    <dd className="mt-1 break-words text-slate-600">{result.objective}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold text-slate-900">Explicación para el profesor</dt>
                    <dd className="mt-1 break-words text-slate-600">{result.explanation}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold text-slate-900">Ejemplo alternativo</dt>
                    <dd className="mt-1 break-words text-slate-600">{result.example}</dd>
                  </div>
                </dl>
              </article>

              <article className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-black text-slate-950">Pasos de la intervención</h3>
                <ol className="mt-4 space-y-3">
                  {result.steps.map((step, index) => (
                    <li className="flex gap-3" key={`${step.instruction}-${index}`}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-800">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm leading-6 text-slate-700">{step.instruction}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {step.duration_minutes} {step.duration_minutes === 1 ? 'minuto' : 'minutos'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <h3 className="font-black text-slate-950">Pregunta de comprobación</h3>
                <p className="mt-3 break-words text-sm leading-6 text-slate-700">{result.check_question}</p>
                <p className="mt-4 text-xs font-extrabold text-blue-800 uppercase">Respuesta esperada</p>
                <p className="mt-1 break-words text-sm leading-6 text-slate-700">{result.expected_answer}</p>
              </article>
              <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="flex items-center gap-2 font-black text-slate-950">
                  <AlertTriangle className="size-4 text-amber-700" aria-hidden="true" />
                  Qué observar
                </h3>
                <p className="mt-3 break-words text-sm leading-6 text-slate-700">{result.misconception_to_watch}</p>
                <p className="mt-4 text-xs font-extrabold text-amber-800 uppercase">Acción según la respuesta</p>
                <p className="mt-1 break-words text-sm leading-6 text-slate-700">{result.follow_up_action}</p>
              </article>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap">
              <Button className="w-full sm:w-auto" onClick={() => void copyIntervention()} variant="secondary">
                {copyState === 'copied' ? (
                  <Check className="size-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copyState === 'copied' ? 'Intervención copiada' : 'Copiar intervención'}
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={isGenerating || inProgress}
                isLoading={isGenerating}
                onClick={() => void onRegenerate()}
                variant="ghost"
              >
                {!isGenerating && <RefreshCw className="size-4" aria-hidden="true" />}
                Regenerar
              </Button>
              {showOpenPulseAction && (
                <Button
                  className="w-full sm:ml-auto sm:w-auto"
                  disabled={Boolean(openDisabledReason) || isGenerating || inProgress}
                  id={openButtonId}
                  isLoading={isOpeningPulse}
                  onClick={() => setIsConfirmingPulse(true)}
                >
                  {!isOpeningPulse && <RadioTower className="size-4" aria-hidden="true" />}
                  Abrir nuevo pulso
                </Button>
              )}
            </div>
            <p aria-live="polite" className="mt-3 text-sm font-semibold text-slate-600">
              {copyState === 'error'
                ? 'No pudimos copiar automáticamente. Selecciona el texto visible e intenta de nuevo.'
                : openDisabledReason && showOpenPulseAction
                  ? openDisabledReason
                  : ''}
            </p>

            {isConfirmingPulse && showOpenPulseAction && (
              <div
                aria-label="Confirmar nuevo pulso"
                className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                id={confirmationId}
                role="group"
                tabIndex={-1}
              >
                <p className="font-black text-amber-950">¿Abrir el siguiente pulso?</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  El pulso actual quedará cerrado y el grupo podrá responder otra vez con el mismo enlace. Esta acción no publica ni califica nada.
                </p>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button disabled={isOpeningPulse} onClick={() => setIsConfirmingPulse(false)} variant="ghost">
                    Cancelar
                  </Button>
                  <Button
                    disabled={Boolean(openDisabledReason)}
                    isLoading={isOpeningPulse}
                    onClick={() => void confirmOpenPulse()}
                  >
                    Sí, abrir nuevo pulso
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {previousRuns.length > 0 && (
          <details className="mt-5 rounded-2xl border border-slate-200">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span className="flex items-center gap-2">
                <History className="size-4" aria-hidden="true" />
                Historial de este concepto ({previousRuns.length})
              </span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </summary>
            <ul className="border-t border-slate-100 px-4 py-2">
              {previousRuns.slice(0, 8).map((run) => (
                <li className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3 text-sm last:border-0" key={run.id}>
                  <span className="font-semibold text-slate-700">
                    {formatDateTime(run.completed_at ?? run.created_at)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                    {run.status === 'completed' ? 'Completada' : run.status === 'failed' ? 'Falló' : 'En curso'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
