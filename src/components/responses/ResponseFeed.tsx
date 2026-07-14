import { MessageSquareText } from 'lucide-react'

import { cn } from '../../lib/cn'
import { formatTime, statusContent } from '../../lib/format'
import type { StudentResponse, UnderstandingStatus } from '../../types/domain'
import { EmptyState } from '../ui/EmptyState'

const badgeStyles: Record<UnderstandingStatus, string> = {
  understood: 'bg-emerald-50 text-emerald-800',
  question: 'bg-amber-50 text-amber-800',
  lost: 'bg-red-50 text-red-800',
}

export function ResponseFeed({ responses }: { responses: StudentResponse[] }) {
  if (responses.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-5" aria-hidden="true" />}
        title="Aún no hay respuestas"
      >
        Comparte el código o el QR. Las respuestas aparecerán aquí sin recargar la página.
      </EmptyState>
    )
  }

  return (
    <ol
      aria-label="Respuestas más recientes"
      aria-live="polite"
      aria-relevant="additions"
      className="space-y-3"
    >
      {responses.map((response) => (
        <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" key={response.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-extrabold', badgeStyles[response.status])}>
              {statusContent[response.status].label}
            </span>
            <time className="text-xs font-semibold text-slate-500" dateTime={response.created_at}>
              {formatTime(response.created_at)}
            </time>
          </div>
          <p className={cn('mt-3 text-sm leading-6', response.question_text ? 'text-slate-800' : 'italic text-slate-400')}>
            {response.question_text || 'Sin duda escrita.'}
          </p>
        </li>
      ))}
    </ol>
  )
}
