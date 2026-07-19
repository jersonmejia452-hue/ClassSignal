import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { BookOpenCheck, Eye, EyeOff, FileText, MessageCircleQuestion, Trash2 } from 'lucide-react'

import type { SessionPublication } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'

type PublicationDraft = Pick<
  SessionPublication,
  'summary' | 'resources' | 'questions_published'
>

interface SessionPublicationPanelProps {
  error?: string | null
  onDelete: () => Promise<unknown>
  onSave: (draft: PublicationDraft) => Promise<unknown>
  publication: SessionPublication | null
}

const minimumSummaryLength = 10
const maximumSummaryLength = 5000
const maximumResourcesLength = 2000

export function SessionPublicationPanel({
  error = null,
  onDelete,
  onSave,
  publication,
}: SessionPublicationPanelProps) {
  const idPrefix = useId()
  const summaryId = `${idPrefix}-summary`
  const resourcesId = `${idPrefix}-resources`
  const titleId = `${idPrefix}-title`
  const confirmationTitleId = `${idPrefix}-confirmation-title`
  const confirmationDescriptionId = `${idPrefix}-confirmation-description`
  const deleteTriggerId = `${idPrefix}-delete-trigger`
  const confirmationRef = useRef<HTMLDivElement>(null)
  const hasOpenedConfirmationRef = useRef(false)
  const [summary, setSummary] = useState(publication?.summary ?? '')
  const [resources, setResources] = useState(publication?.resources ?? '')
  const [questionsPublished, setQuestionsPublished] = useState(
    publication?.questions_published ?? false,
  )
  const [summaryError, setSummaryError] = useState<string | undefined>()
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  useEffect(() => {
    setSummary(publication?.summary ?? '')
    setResources(publication?.resources ?? '')
    setQuestionsPublished(publication?.questions_published ?? false)
    setSummaryError(undefined)
    setActionError(null)
    setIsConfirmingDelete(false)
  }, [
    publication?.questions_published,
    publication?.resources,
    publication?.session_id,
    publication?.summary,
    publication?.updated_at,
  ])

  useEffect(() => {
    if (isConfirmingDelete) {
      hasOpenedConfirmationRef.current = true
      confirmationRef.current?.focus()
    } else if (hasOpenedConfirmationRef.current) {
      const focusTarget = document.getElementById(deleteTriggerId)
        ?? document.getElementById(summaryId)
      focusTarget?.focus()
      hasOpenedConfirmationRef.current = false
    }
  }, [deleteTriggerId, isConfirmingDelete, summaryId])

  const normalizedSummary = summary.trim()
  const normalizedResources = resources.trim()
  const initialSummary = publication?.summary.trim() ?? ''
  const initialResources = publication?.resources?.trim() ?? ''
  const isDirty = normalizedSummary !== initialSummary
    || normalizedResources !== initialResources
    || questionsPublished !== (publication?.questions_published ?? false)
  const isBusy = isSaving || isDeleting
  const isInteractionLocked = isBusy || isConfirmingDelete
  const canRefreshPublishedQuestions = Boolean(publication && questionsPublished)

  const resetDraft = () => {
    setSummary(publication?.summary ?? '')
    setResources(publication?.resources ?? '')
    setQuestionsPublished(publication?.questions_published ?? false)
    setSummaryError(undefined)
    setActionError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isInteractionLocked) return
    setActionError(null)

    if (normalizedSummary.length < minimumSummaryLength) {
      setSummaryError(`Escribe al menos ${minimumSummaryLength} caracteres.`)
      return
    }

    setSummaryError(undefined)
    setIsSaving(true)

    try {
      await onSave({
        summary: normalizedSummary,
        resources: normalizedResources || null,
        questions_published: questionsPublished,
      })
    } catch {
      setActionError('No pudimos guardar la publicación. Revisa la información e intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const deletePublication = async () => {
    if (isBusy) return
    setActionError(null)
    setIsDeleting(true)

    try {
      await onDelete()
      setIsConfirmingDelete(false)
    } catch {
      setActionError('No pudimos retirar la publicación. Intenta de nuevo.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="size-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-slate-950" id={titleId}>
            Publicación para estudiantes
          </h2>
        </div>
        <span
          className={publication
            ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700'
            : 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600'}
        >
          {publication ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
          {publication ? 'Visible en el curso' : 'Sin publicar'}
        </span>
      </div>

      <form className="space-y-6 p-5 sm:p-6" noValidate onSubmit={handleSubmit}>
        <div>
          <p className="text-sm leading-6 text-slate-600">
            Conserva un resumen y materiales de esta clase en el portal del estudiante. Publicar no vincula las respuestas anónimas con las cuentas inscritas.
          </p>
        </div>

        {(error || actionError) && (
          <Alert tone="error">{error || actionError}</Alert>
        )}

        <Field
          error={summaryError}
          hint="Explica los conceptos vistos y lo que conviene repasar."
          htmlFor={summaryId}
          label="Resumen de la clase"
        >
          <textarea
            aria-describedby={summaryError ? `${summaryId}-error` : `${summaryId}-hint`}
            aria-invalid={Boolean(summaryError)}
            className="form-input min-h-36 resize-y py-3"
            disabled={isInteractionLocked}
            id={summaryId}
            maxLength={maximumSummaryLength}
            onChange={(event) => {
              setSummary(event.target.value)
              if (summaryError) setSummaryError(undefined)
            }}
            placeholder="Ej. Repasamos la regla de la cadena y resolvimos ejercicios con funciones compuestas..."
            required
            value={summary}
          />
          <p className="mt-2 text-right text-xs font-bold text-slate-400" aria-live="polite">
            {summary.length} / {maximumSummaryLength}
          </p>
        </Field>

        <Field
          hint="Opcional. Agrega enlaces o indicaciones, una por línea."
          htmlFor={resourcesId}
          label="Recursos y próximos pasos"
        >
          <textarea
            aria-describedby={`${resourcesId}-hint`}
            className="form-input min-h-28 resize-y py-3"
            disabled={isInteractionLocked}
            id={resourcesId}
            maxLength={maximumResourcesLength}
            onChange={(event) => setResources(event.target.value)}
            placeholder={'Guía de ejercicios: https://...\nLeer las páginas 42–48'}
            value={resources}
          />
          <p className="mt-2 text-right text-xs font-bold text-slate-400" aria-live="polite">
            {resources.length} / {maximumResourcesLength}
          </p>
        </Field>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800">
              <MessageCircleQuestion className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-950">Publicar muro moderado</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Guarda una copia de las dudas aprobadas en ese momento, sin nombres ni datos de respuesta. Las dudas nuevas no se publican automáticamente.
              </p>
            </div>
          </div>
          <Button
            aria-checked={questionsPublished}
            className="mt-4 w-full shrink-0 sm:mt-0 sm:w-auto sm:min-w-36"
            disabled={isInteractionLocked}
            onClick={() => setQuestionsPublished((current) => !current)}
            role="switch"
            variant={questionsPublished ? 'secondary' : 'primary'}
          >
            {questionsPublished ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
            {questionsPublished ? 'Incluido' : 'No incluido'}
          </Button>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {publication && !isConfirmingDelete && (
              <Button
                disabled={isInteractionLocked}
                id={deleteTriggerId}
                onClick={() => setIsConfirmingDelete(true)}
                variant="danger"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Retirar publicación
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {isDirty && (
              <Button disabled={isInteractionLocked} onClick={resetDraft} variant="ghost">
                Descartar cambios
              </Button>
            )}
            <Button
              disabled={isInteractionLocked
                || (Boolean(publication) && !isDirty && !canRefreshPublishedQuestions)}
              isLoading={isSaving}
              type="submit"
            >
              <FileText className="size-4" aria-hidden="true" />
              {publication
                ? isDirty
                  ? 'Guardar cambios'
                  : 'Actualizar muro'
                : 'Publicar clase'}
            </Button>
          </div>
        </div>
      </form>

      {isConfirmingDelete && publication && (
        <div
          aria-describedby={confirmationDescriptionId}
          aria-labelledby={confirmationTitleId}
          aria-live="assertive"
          className="border-t border-red-200 bg-red-50 px-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700 sm:px-6"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !isDeleting) {
              event.preventDefault()
              setIsConfirmingDelete(false)
            }
          }}
          ref={confirmationRef}
          role="region"
          tabIndex={-1}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800">
              <Trash2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-red-950" id={confirmationTitleId}>¿Retirar esta publicación?</p>
              <p className="mt-1 text-sm leading-6 text-red-900" id={confirmationDescriptionId}>
                El resumen, los recursos y el muro dejarán de verse en el portal estudiantil. Podrás publicarlos de nuevo más adelante.
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button disabled={isDeleting} onClick={() => setIsConfirmingDelete(false)} variant="ghost">
                  Cancelar
                </Button>
                <Button isLoading={isDeleting} onClick={() => void deletePublication()} variant="danger">
                  Sí, retirar publicación
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
