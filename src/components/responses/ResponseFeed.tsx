import { Eye, EyeOff, MessageSquareText } from 'lucide-react'

import { cn } from '../../lib/cn'
import { formatTime, statusContent } from '../../lib/format'
import type { StudentResponse, UnderstandingStatus } from '../../types/domain'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

const badgeStyles: Record<UnderstandingStatus, string> = {
  understood: 'bg-emerald-50 text-emerald-800',
  question: 'bg-amber-50 text-amber-800',
  lost: 'bg-red-50 text-red-800',
}

interface ResponseFeedProps {
  ariaLabel?: string
  emptyDescription?: string
  emptyTitle?: string
  responses: StudentResponse[]
  onStudentVisibilityChange?: (
    responseId: string,
    isVisibleToStudents: boolean,
  ) => void | Promise<void>
  updatingResponseId?: string | null
}

export function ResponseFeed({
  ariaLabel = 'Respuestas más recientes',
  emptyDescription = 'Comparte el código o el QR. Las respuestas aparecerán aquí sin recargar la página.',
  emptyTitle = 'Aún no hay respuestas',
  responses,
  onStudentVisibilityChange,
  updatingResponseId = null,
}: ResponseFeedProps) {
  if (responses.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-5" aria-hidden="true" />}
        title={emptyTitle}
      >
        {emptyDescription}
      </EmptyState>
    )
  }

  return (
    <ol
      aria-label={ariaLabel}
      aria-live="polite"
      aria-relevant="additions"
      className="space-y-3"
    >
      {responses.map((response) => {
        const hasWrittenQuestion = Boolean(response.question_text?.trim())
        const canModerate = Boolean(onStudentVisibilityChange) && hasWrittenQuestion
        const isUpdating = updatingResponseId === response.id

        return (
          <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" key={response.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-extrabold', badgeStyles[response.status])}>
                {statusContent[response.status].label}
              </span>
              <time className="text-xs font-semibold text-slate-500" dateTime={response.created_at}>
                {formatTime(response.created_at)}
              </time>
            </div>
            <p className={cn('mt-3 break-words text-sm leading-6', response.question_text ? 'text-slate-800' : 'italic text-slate-400')}>
              {response.question_text || 'Sin duda escrita.'}
            </p>

            {canModerate && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span
                  className={cn(
                    'inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold',
                    response.is_visible_to_students
                      ? 'bg-blue-50 text-blue-800'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {response.is_visible_to_students ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  )}
                  {response.is_visible_to_students
                    ? 'Incluida en el muro'
                    : 'Excluida del muro'}
                </span>

                <Button
                  aria-label={response.is_visible_to_students
                    ? 'Excluir esta duda del muro de estudiantes'
                    : 'Incluir esta duda en el muro de estudiantes'}
                  aria-pressed={response.is_visible_to_students}
                  className="min-h-10 px-3 text-xs"
                  disabled={Boolean(updatingResponseId)}
                  isLoading={isUpdating}
                  onClick={() => void onStudentVisibilityChange?.(
                    response.id,
                    !response.is_visible_to_students,
                  )}
                  variant="secondary"
                >
                  {response.is_visible_to_students ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                  {response.is_visible_to_students ? 'Excluir' : 'Incluir'}
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
