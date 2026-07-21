import { useEffect, useId, useRef } from 'react'
import {
  Bot,
  Check,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

import { useSessionAiArtifacts } from '../../hooks/useSessionAiArtifacts'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import type { PublicationAiDraftValues } from './publicationAiDraftState'

interface PublicationAiDraftPanelProps {
  applyConfirmationOpen: boolean
  disabled?: boolean
  dismissedArtifactId: string | null
  onCancelApply: () => void
  onConfirmApply: () => void
  onDiscard: (artifactId: string) => void
  onRefreshSources?: () => Promise<unknown> | unknown
  onRequestApply: (draft: PublicationAiDraftValues) => void
  onRevealArtifact: () => void
  sessionId: string
  sourcesReady?: boolean
  sourceUpdatedAt?: string | null
}

interface ReviewNote {
  field: 'resources' | 'summary'
  message: string
}

interface PublicationDraftPreview {
  createdAt: string
  draft: PublicationAiDraftValues
  id: string
  reviewNotes: ReviewNote[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readReviewNotes(value: unknown): ReviewNote[] | null {
  if (!Array.isArray(value)) return null

  const notes: ReviewNote[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    if (item.field !== 'summary' && item.field !== 'resources') return null
    if (typeof item.message !== 'string' || !item.message.trim()) return null
    notes.push({ field: item.field, message: item.message.trim() })
  }
  return notes
}

function readPublicationDraftPreview(
  artifact: unknown,
  sessionId: string,
): PublicationDraftPreview | null {
  if (!isRecord(artifact)) return null
  if (
    typeof artifact.id !== 'string'
    || artifact.session_id !== sessionId
    || artifact.kind !== 'publication_draft'
    || artifact.status !== 'completed'
    || typeof artifact.source_captured_at !== 'string'
    || Number.isNaN(Date.parse(artifact.source_captured_at))
    || !isRecord(artifact.result)
  ) {
    return null
  }

  const { result } = artifact
  const reviewNotes = readReviewNotes(result.review_notes)
  if (
    typeof result.summary !== 'string'
    || result.summary.trim().length < 10
    || result.summary.length > 5000
    || typeof result.resources_and_next_steps !== 'string'
    || result.resources_and_next_steps.length > 2000
    || reviewNotes === null
  ) {
    return null
  }

  return {
    createdAt: artifact.source_captured_at,
    draft: {
      resourcesAndNextSteps: result.resources_and_next_steps.trim(),
      summary: result.summary.trim(),
    },
    id: artifact.id,
    reviewNotes,
  }
}

function isDraftStale(createdAt: string, sourceUpdatedAt?: string | null) {
  if (!sourceUpdatedAt) return false
  const sourceTime = Date.parse(sourceUpdatedAt)
  const draftTime = Date.parse(createdAt)
  return !Number.isNaN(sourceTime)
    && !Number.isNaN(draftTime)
    && sourceTime > draftTime
}

function reviewNoteLabel(field: ReviewNote['field']) {
  return field === 'summary' ? 'Resumen' : 'Recursos y próximos pasos'
}

export function PublicationAiDraftPanel({
  applyConfirmationOpen,
  disabled = false,
  dismissedArtifactId,
  onCancelApply,
  onConfirmApply,
  onDiscard,
  onRefreshSources,
  onRequestApply,
  onRevealArtifact,
  sessionId,
  sourcesReady = true,
  sourceUpdatedAt = null,
}: PublicationAiDraftPanelProps) {
  const idPrefix = useId()
  const titleId = `${idPrefix}-title`
  const previewTitleId = `${idPrefix}-preview-title`
  const confirmationTitleId = `${idPrefix}-confirmation-title`
  const confirmationDescriptionId = `${idPrefix}-confirmation-description`
  const generateButtonId = `${idPrefix}-generate`
  const applyButtonId = `${idPrefix}-apply`
  const previewRef = useRef<HTMLElement>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)
  const focusPreviewAfterGenerationRef = useRef(false)
  const hadApplyConfirmationRef = useRef(false)
  const {
    latestCompleted,
    isLoading,
    isGenerating,
    error,
    lastInvocationWasCached,
    inProgress,
    hasTimedOutPending,
    refresh,
    generateArtifact,
  } = useSessionAiArtifacts(sessionId, 'publication_draft')

  const preview = readPublicationDraftPreview(latestCompleted, sessionId)
  const isVisible = Boolean(preview && preview.id !== dismissedArtifactId)
  const isStale = Boolean(preview && isDraftStale(preview.createdAt, sourceUpdatedAt))
  const hasInvalidCompletedArtifact = Boolean(latestCompleted && !preview)
  const hasLiveGeneration = Boolean(inProgress) && !hasTimedOutPending
  const actionsDisabled = disabled || !sourcesReady || isGenerating || hasLiveGeneration

  useEffect(() => {
    if (!focusPreviewAfterGenerationRef.current || !isVisible) return
    focusPreviewAfterGenerationRef.current = false
    previewRef.current?.focus()
  }, [isVisible, preview?.id])

  useEffect(() => {
    if (applyConfirmationOpen) {
      hadApplyConfirmationRef.current = true
      confirmationRef.current?.focus()
    } else if (hadApplyConfirmationRef.current) {
      if (isStale || !sourcesReady) previewRef.current?.focus()
      else document.getElementById(applyButtonId)?.focus()
      hadApplyConfirmationRef.current = false
    }
  }, [applyButtonId, applyConfirmationOpen, isStale, sourcesReady])

  const requestGeneration = async (regenerate: boolean) => {
    if (actionsDisabled || applyConfirmationOpen) return
    focusPreviewAfterGenerationRef.current = true

    try {
      const invocation = await generateArtifact({ regenerate })
      if (
        invocation?.artifact.status === 'completed'
        && invocation.artifact.session_id === sessionId
        && invocation.artifact.kind === 'publication_draft'
      ) {
        onRevealArtifact()
      } else if (
        !invocation
        || invocation.artifact.status !== 'pending'
        || invocation.artifact.session_id !== sessionId
        || invocation.artifact.kind !== 'publication_draft'
      ) {
        focusPreviewAfterGenerationRef.current = false
      }
    } catch {
      focusPreviewAfterGenerationRef.current = false
      // The shared hook exposes the sanitized error shown below.
    }
  }

  const discardPreview = () => {
    if (!preview || actionsDisabled || applyConfirmationOpen) return
    focusPreviewAfterGenerationRef.current = false
    onDiscard(preview.id)
    window.requestAnimationFrame(() => document.getElementById(generateButtonId)?.focus())
  }

  return (
    <section
      aria-labelledby={titleId}
      className="border-b border-blue-100 bg-blue-50/55 px-5 py-5 sm:px-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-950" id={titleId}>
                Borrador con GPT‑5.6
              </h3>
              <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[0.68rem] font-extrabold tracking-wide text-blue-800 uppercase">
                Generado con IA
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Prepara una propuesta a partir de datos agregados de la clase. Nada se aplica ni se publica sin tu revisión.
            </p>
          </div>
        </div>

        {!isVisible && !isLoading && (
          <Button
            className="w-full shrink-0 sm:w-auto"
            disabled={actionsDisabled || applyConfirmationOpen}
            id={generateButtonId}
            isLoading={isGenerating}
            onClick={() => void requestGeneration(hasInvalidCompletedArtifact)}
            variant="secondary"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {hasInvalidCompletedArtifact ? 'Regenerar borrador' : 'Generar borrador'}
          </Button>
        )}
      </div>

      {isLoading && !preview && (
        <div aria-live="polite" className="mt-4 flex items-center gap-2 text-sm font-bold text-blue-900" role="status">
          <span className="size-2 animate-pulse rounded-full bg-blue-600" aria-hidden="true" />
          Comprobando borradores anteriores…
        </div>
      )}

      {!sourcesReady && (
        <Alert className="mt-4" title="Actualizando fuentes de la clase">
          <p>Espera a que terminen de cargar los pulsos, las señales y los mapas antes de generar o aplicar un borrador.</p>
          {onRefreshSources && (
            <button
              className="mt-2 min-h-10 font-extrabold underline underline-offset-2"
              disabled={disabled}
              onClick={() => void onRefreshSources()}
              type="button"
            >
              Reintentar fuentes
            </button>
          )}
        </Alert>
      )}

      {hasLiveGeneration && (
        <Alert className="mt-4" title="Generación en curso">
          <p>Ya se está preparando un borrador para esta clase.</p>
          <button
            className="mt-2 min-h-10 font-extrabold underline underline-offset-2"
            disabled={disabled}
            onClick={() => void refresh()}
            type="button"
          >
            Actualizar estado
          </button>
        </Alert>
      )}

      {hasTimedOutPending && (
        <Alert className="mt-4" title="La generación anterior tardó demasiado">
          Puedes intentar generar el borrador nuevamente. No se aplicó ningún cambio al formulario.
        </Alert>
      )}

      {error && <Alert className="mt-4" tone="error">{error}</Alert>}
      {hasInvalidCompletedArtifact && (
        <Alert className="mt-4" tone="error">
          El borrador recibido no corresponde a esta clase o tiene un formato inesperado. Regenera la propuesta.
        </Alert>
      )}

      {isVisible && preview && (
        <article
          aria-labelledby={previewTitleId}
          className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:p-5"
          ref={previewRef}
          tabIndex={-1}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.68rem] font-extrabold tracking-[0.12em] text-blue-700 uppercase">
                Vista previa separada
              </p>
              <h4 className="mt-1 font-extrabold text-slate-950" id={previewTitleId}>
                Borrador generado con IA
              </h4>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Estado del borrador">
              {lastInvocationWasCached && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">
                  Resultado reutilizado
                </span>
              )}
              {isStale && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900">
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  Desactualizado
                </span>
              )}
            </div>
          </div>

          {isStale && (
            <Alert className="mt-4" title="Las fuentes de la clase cambiaron">
              Regenera el borrador antes de aplicarlo al formulario.
            </Alert>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h5 className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">Resumen propuesto</h5>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {preview.draft.summary}
              </p>
            </div>
            <div>
              <h5 className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
                Recursos y próximos pasos propuestos
              </h5>
              {preview.draft.resourcesAndNextSteps ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {preview.draft.resourcesAndNextSteps}
                </p>
              ) : (
                <p className="mt-2 text-sm italic leading-6 text-slate-500">
                  No se propusieron recursos para evitar inventar información.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-950">
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              Información que debes confirmar
            </div>
            {preview.reviewNotes.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                {preview.reviewNotes.map((note, index) => (
                  <li className="flex gap-2" key={`${note.field}-${index}`}>
                    <span aria-hidden="true">•</span>
                    <span><strong>{reviewNoteLabel(note.field)}:</strong> {note.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-amber-950">
                Revisa que el resumen y los próximos pasos coincidan con lo trabajado antes de publicar.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
            Aplicar sólo modifica este formulario local. Usa después el botón normal de publicar o guardar.
          </p>

          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              disabled={actionsDisabled || applyConfirmationOpen || isStale || !sourcesReady}
              id={applyButtonId}
              onClick={() => onRequestApply(preview.draft)}
            >
              <Check className="size-4" aria-hidden="true" />
              Aplicar al formulario
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={actionsDisabled || applyConfirmationOpen}
              isLoading={isGenerating}
              onClick={() => void requestGeneration(true)}
              variant="secondary"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Regenerar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={actionsDisabled || applyConfirmationOpen}
              onClick={discardPreview}
              variant="ghost"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Descartar
            </Button>
          </div>
        </article>
      )}

      {applyConfirmationOpen && preview && (
        <div
          aria-describedby={confirmationDescriptionId}
          aria-labelledby={confirmationTitleId}
          aria-live="assertive"
          className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 sm:p-5"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onCancelApply()
            }
          }}
          ref={confirmationRef}
          role="region"
          tabIndex={-1}
        >
          <p className="font-extrabold text-amber-950" id={confirmationTitleId}>
            ¿Reemplazar el contenido local del formulario?
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900" id={confirmationDescriptionId}>
            El resumen o los recursos actuales son diferentes. Esta acción los reemplazará, pero no guardará ni publicará nada.
          </p>
          <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
            <Button className="w-full sm:w-auto" onClick={onCancelApply} variant="ghost">
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={isStale}
              onClick={onConfirmApply}
            >
              Sí, aplicar localmente
            </Button>
          </div>
        </div>
      )}

      <span aria-live="polite" className="sr-only">
        {isGenerating ? 'Generando borrador con inteligencia artificial.' : ''}
      </span>
    </section>
  )
}
