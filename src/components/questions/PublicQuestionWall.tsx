import { EyeOff, MessageSquareText, RefreshCw } from 'lucide-react'

import type { PublicSessionQuestion } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

interface PublicQuestionWallProps {
  questions: PublicSessionQuestion[]
  isVisible: boolean
  hasLoaded: boolean
  isInitialLoading: boolean
  isRefreshing: boolean
  error: string | null
  onRefresh: () => Promise<void>
}

export function PublicQuestionWall({
  questions,
  isVisible,
  hasLoaded,
  isInitialLoading,
  isRefreshing,
  error,
  onRefresh,
}: PublicQuestionWallProps) {
  const countLabel = `${questions.length} ${questions.length === 1 ? 'duda compartida' : 'dudas compartidas'}`

  return (
    <section
      aria-labelledby="public-question-wall-title"
      className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(7,26,43,0.06)] sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
            Conversación de la clase
          </p>
          <h2
            className="mt-2 text-2xl font-black tracking-tight text-slate-950"
            id="public-question-wall-title"
          >
            Dudas compartidas
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lee preguntas anónimas de tu grupo. Puede que alguien esté pensando lo mismo que tú.
          </p>
        </div>

        <Button
          aria-label="Actualizar dudas compartidas"
          className="shrink-0 px-3 sm:px-4"
          disabled={isRefreshing || isInitialLoading}
          onClick={() => void onRefresh()}
          variant="secondary"
        >
          <RefreshCw
            className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {error && (
        <Alert className="mt-5" tone="error" title="No pudimos actualizar">
          {hasLoaded
            ? 'Mostramos la última versión disponible. Puedes intentarlo nuevamente.'
            : error}
        </Alert>
      )}

      {isInitialLoading ? (
        <div className="mt-6 space-y-3" aria-label="Cargando dudas compartidas" role="status">
          {[0, 1, 2].map((item) => (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={item}>
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : !hasLoaded ? null : !isVisible ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <EyeOff className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-extrabold text-slate-900">El muro está oculto</p>
            <p className="mt-1 text-sm leading-6">
              El profesor aún no ha compartido las dudas con el grupo.
            </p>
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MessageSquareText className="size-5" aria-hidden="true" />}
            title="Todavía no hay dudas compartidas"
          >
            Si algo no te queda claro, puedes ser la primera persona en escribirlo.
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm font-extrabold text-slate-600" aria-live="polite">
            {countLabel}
          </p>
          <ol className="mt-3 space-y-3">
            {questions.map((question) => (
              <li
                className="break-words rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[0.95rem] leading-7 text-slate-800"
                key={question.id}
              >
                {question.question_text}
              </li>
            ))}
          </ol>
        </>
      )}

      {hasLoaded && isVisible && (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Solo mostramos el texto de las dudas. Nunca el nombre ni el estado de comprensión de quien respondió.
        </p>
      )}
    </section>
  )
}
