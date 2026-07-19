import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Clock3, FileText, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { ArchivedQuestionWall } from '../../components/student/ArchivedQuestionWall'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDateTime } from '../../lib/format'
import {
  getStudentSessionArchive,
  listStudentArchiveQuestions,
} from '../../services/studentPortal.service'
import type {
  StudentArchiveQuestion,
  StudentSessionArchive,
} from '../../types/domain'

export function StudentClassDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [archive, setArchive] = useState<StudentSessionArchive | null>(null)
  const [questions, setQuestions] = useState<StudentArchiveQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const requestId = useRef(0)

  const loadArchive = useCallback(async () => {
    const nextRequestId = requestId.current + 1
    requestId.current = nextRequestId

    if (!sessionId) {
      setArchive(null)
      setQuestions([])
      setError('No encontramos esta clase entre tus cursos.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setQuestionsError(null)

    try {
      const archiveResult = await getStudentSessionArchive(sessionId)
      if (requestId.current !== nextRequestId) return

      setArchive(archiveResult)
      setQuestions([])

      if (!archiveResult) {
        setError('No encontramos esta clase entre tus cursos.')
        return
      }

      if (archiveResult.questions_published) {
        try {
          const questionResult = await listStudentArchiveQuestions(sessionId)
          if (requestId.current !== nextRequestId) return
          setQuestions(questionResult)
        } catch {
          if (requestId.current !== nextRequestId) return
          setQuestionsError('No pudimos cargar el muro publicado. Intenta nuevamente.')
        }
      }
    } catch {
      if (requestId.current !== nextRequestId) return
      setArchive(null)
      setQuestions([])
      setError('No pudimos cargar esta clase. Revisa tu conexión e intenta nuevamente.')
    } finally {
      if (requestId.current === nextRequestId) setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadArchive()
    return () => {
      requestId.current += 1
    }
  }, [loadArchive])

  if (isLoading) {
    return (
      <div aria-label="Cargando clase" className="animate-pulse" role="status">
        <div className="h-5 w-36 rounded bg-slate-200" />
        <div className="mt-5 h-64 rounded-[1.5rem] bg-[#dfe6ef]" />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="h-64 rounded-2xl bg-white" />
          <div className="h-64 rounded-2xl bg-white" />
        </div>
      </div>
    )
  }

  if (!archive) {
    return (
      <div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b]" to="/estudiante">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a mis cursos
        </Link>
        <div className="mt-6">
          <EmptyState
            action={(
              <Button onClick={() => void loadArchive()} variant="secondary">
                <RefreshCw className="size-4" aria-hidden="true" />
                Reintentar
              </Button>
            )}
            icon={<BookOpen className="size-5" aria-hidden="true" />}
            title="No encontramos esta clase"
          >
            {error || 'Puede que no pertenezca a uno de tus cursos o que haya sido eliminada.'}
          </EmptyState>
        </div>
      </div>
    )
  }

  const hasPublishedSummary = Boolean(archive.summary && archive.published_at)

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to={`/estudiante/curso/${archive.course_id}`}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a {archive.course_name}
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-[1.6rem] bg-[#071a2b] p-6 text-white shadow-[0_20px_60px_rgba(7,26,43,0.18)] sm:p-8 lg:p-10">
        <div className="absolute top-0 right-0 h-full w-2/5 bg-[radial-gradient(circle_at_top_right,rgba(49,92,246,0.4),transparent_66%)]" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className={archive.is_active
              ? 'inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-extrabold text-emerald-200'
              : 'inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-slate-200'}
            >
              <span className={archive.is_active ? 'size-2 rounded-full bg-emerald-400' : 'size-2 rounded-full bg-slate-400'} aria-hidden="true" />
              {archive.is_active ? 'En vivo' : 'Clase finalizada'}
            </span>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#87eadc] uppercase">
              {archive.subject}
            </p>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {archive.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            {archive.topic}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-400">
            <Clock3 className="size-4" aria-hidden="true" />
            {formatDateTime(archive.created_at)}
          </p>

          {archive.is_active && (
            <div className="mt-7">
              <Link
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#66e2d1] px-5 py-3 text-sm font-extrabold text-[#071a2b] transition hover:bg-[#87eadc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                rel="noopener noreferrer"
                target="_blank"
                to={`/s/${archive.code}`}
              >
                <PlayCircle className="size-5" aria-hidden="true" />
                Participar en vivo
              </Link>
              <p className="mt-3 flex max-w-xl items-start gap-2 text-xs leading-5 text-slate-300">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#66e2d1]" aria-hidden="true" />
                Tu respuesta se envía por el canal anónimo y no se vincula con esta cuenta. El formulario se abre en otra pestaña para conservar el curso aquí.
              </p>
            </div>
          )}
        </div>
      </section>

      {error && <Alert className="mt-5" tone="error">{error}</Alert>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="published-summary-title" className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_12px_38px_rgba(7,26,43,0.055)] sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold tracking-[0.12em] text-blue-700 uppercase">Material publicado</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[#071a2b]" id="published-summary-title">
                Resumen de la clase
              </h2>
            </div>
          </div>

          {hasPublishedSummary ? (
            <div className="mt-6">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{archive.summary}</p>
              {archive.resources && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-extrabold text-slate-950">Recursos y próximos pasos</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{archive.resources}</p>
                </div>
              )}
              <p className="mt-6 text-xs font-medium text-slate-400">
                Publicado {formatDateTime(archive.published_at!)}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <p className="font-extrabold text-slate-900">El profesor aún no ha publicado un resumen</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Vuelve más tarde para consultar el material de esta clase.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="archived-wall-title">
          <h2 className="sr-only" id="archived-wall-title">Muro de dudas publicado</h2>
          {questionsError && (
            <Alert className="mb-4" tone="error">
              {questionsError}{' '}
              <button className="font-extrabold underline underline-offset-2" onClick={() => void loadArchive()} type="button">
                Reintentar
              </button>
            </Alert>
          )}
          {!questionsError && (
            <ArchivedQuestionWall
              isPublished={archive.questions_published}
              questions={questions}
            />
          )}
        </section>
      </div>
    </div>
  )
}
