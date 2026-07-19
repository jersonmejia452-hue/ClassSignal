import { EyeOff, MessageSquareText } from 'lucide-react'

import type { StudentArchiveQuestion } from '../../types/domain'
import { EmptyState } from '../ui/EmptyState'

interface ArchivedQuestionWallProps {
  questions: StudentArchiveQuestion[]
  isPublished: boolean
}

export function ArchivedQuestionWall({ questions, isPublished }: ArchivedQuestionWallProps) {
  const countLabel = `${questions.length} ${questions.length === 1 ? 'duda compartida' : 'dudas compartidas'}`

  return (
    <section
      aria-labelledby="archived-question-wall-title"
      className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(7,26,43,0.06)] sm:p-7"
    >
      <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
        Conversación de la clase
      </p>
      <h2
        className="mt-2 text-2xl font-black tracking-tight text-slate-950"
        id="archived-question-wall-title"
      >
        Muro de dudas
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Repasa las preguntas anónimas que el profesor moderó y compartió con el curso.
      </p>

      {!isPublished ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <EyeOff className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-extrabold text-slate-900">El muro aún no está publicado</p>
            <p className="mt-1 text-sm leading-6">
              El profesor decidirá cuándo compartir las dudas de esta clase con el curso.
            </p>
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MessageSquareText className="size-5" aria-hidden="true" />}
            title="No hay dudas compartidas"
          >
            No se publicaron preguntas para esta clase.
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm font-extrabold text-slate-600">{countLabel}</p>
          <ol className="mt-3 space-y-3">
            {questions.map((question) => (
              <li
                className="break-words rounded-2xl border border-slate-200 bg-slate-50 p-4"
                key={question.response_id}
              >
                <p className="text-xs font-extrabold tracking-[0.1em] text-blue-700 uppercase">
                  Momento {question.pulse_ordinal}
                </p>
                <p className="mt-2 text-[0.95rem] leading-7 text-slate-800">
                  {question.question_text}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}

      {isPublished && (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Solo mostramos el texto de las dudas. Las respuestas siguen siendo anónimas y no se vinculan con tu cuenta.
        </p>
      )}
    </section>
  )
}
