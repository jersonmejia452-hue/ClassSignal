import { ExternalLink, Eye, EyeOff, MessageCircleQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { StudentResponse } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

interface StudentQuestionWallControlProps {
  disabledReason?: string
  error?: string | null
  isActive: boolean
  isUpdating?: boolean
  isVisible: boolean
  onToggle: () => void | Promise<void>
  responses: StudentResponse[]
  sessionCode: string
}

export function StudentQuestionWallControl({
  disabledReason,
  error = null,
  isActive,
  isUpdating = false,
  isVisible,
  onToggle,
  responses,
  sessionCode,
}: StudentQuestionWallControlProps) {
  const questions = responses.filter((response) => response.question_text?.trim())
  const visibleQuestionCount = questions.filter(
    (response) => response.is_visible_to_students,
  ).length
  const isDisabled = !isActive || Boolean(disabledReason)

  return (
    <section
      aria-labelledby="student-question-wall-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="size-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-slate-950" id="student-question-wall-title">
            Muro de dudas para estudiantes
          </h2>
        </div>
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          rel="noreferrer"
          target="_blank"
          to={`/s/${sessionCode}`}
        >
          Ver como estudiante
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </Link>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <div>
          <p className="text-sm leading-6 text-slate-600">
            Comparte todas las dudas escritas que no hayas excluido, sin mostrar quién las envió.
          </p>
          <p className="mt-3 text-sm font-extrabold text-slate-900" aria-live="polite">
            {visibleQuestionCount} de {questions.length}{' '}
            {isVisible ? 'dudas visibles' : 'dudas incluidas al compartir'}
          </p>
        </div>

        <Button
          aria-checked={isVisible}
          aria-label={isVisible
            ? 'Ocultar el muro de dudas a los estudiantes'
            : 'Mostrar el muro de dudas a los estudiantes'}
          className="min-w-44"
          disabled={isDisabled}
          isLoading={isUpdating}
          onClick={() => void onToggle()}
          role="switch"
          variant={isVisible ? 'secondary' : 'primary'}
        >
          {isVisible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
          {isVisible ? 'Ocultar muro' : 'Compartir dudas'}
        </Button>
      </div>

      {isDisabled && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert>
            {disabledReason || 'Reactiva la clase para cambiar quién puede ver sus dudas.'}
          </Alert>
        </div>
      )}

      {error && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
    </section>
  )
}
