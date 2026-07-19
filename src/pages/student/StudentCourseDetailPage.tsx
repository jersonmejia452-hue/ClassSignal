import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Clock3, RadioTower, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { StudentClassCard } from '../../components/student/StudentClassCard'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDateTime } from '../../lib/format'
import {
  getStudentCourseDetails,
  listStudentCourseSessions,
} from '../../services/studentPortal.service'
import type {
  StudentCourseDetails,
  StudentCourseSession,
} from '../../types/domain'

interface CourseLocationState {
  enrollmentStatus?: 'joined' | 'already_enrolled'
}

export function StudentCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const location = useLocation()
  const locationState = location.state as CourseLocationState | null
  const [course, setCourse] = useState<StudentCourseDetails | null>(null)
  const [sessions, setSessions] = useState<StudentCourseSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const loadCourse = useCallback(async () => {
    const nextRequestId = requestId.current + 1
    requestId.current = nextRequestId

    if (!courseId) {
      setCourse(null)
      setSessions([])
      setError('No encontramos este curso entre tus matrículas.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [courseResult, sessionResult] = await Promise.all([
        getStudentCourseDetails(courseId),
        listStudentCourseSessions(courseId),
      ])
      if (requestId.current !== nextRequestId) return

      setCourse(courseResult)
      setSessions(sessionResult)
      if (!courseResult) {
        setError('No encontramos este curso entre tus matrículas.')
      }
    } catch {
      if (requestId.current !== nextRequestId) return
      setCourse(null)
      setSessions([])
      setError('No pudimos cargar este curso. Revisa tu conexión e intenta nuevamente.')
    } finally {
      if (requestId.current === nextRequestId) setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadCourse()
    return () => {
      requestId.current += 1
    }
  }, [loadCourse])

  if (isLoading) {
    return (
      <div aria-label="Cargando curso" className="animate-pulse" role="status">
        <div className="h-5 w-36 rounded bg-slate-200" />
        <div className="mt-5 h-64 rounded-[1.5rem] bg-[#dfe6ef]" />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="h-64 rounded-2xl bg-white" key={index} />
          ))}
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b]" to="/estudiante">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a mis cursos
        </Link>
        <div className="mt-6">
          <EmptyState
            action={(
              <Button onClick={() => void loadCourse()} variant="secondary">
                <RefreshCw className="size-4" aria-hidden="true" />
                Reintentar
              </Button>
            )}
            icon={<BookOpen className="size-5" aria-hidden="true" />}
            title="No encontramos este curso"
          >
            {error || 'Puede que tu matrícula ya no esté activa o que el curso haya sido eliminado.'}
          </EmptyState>
        </div>
      </div>
    )
  }

  const activeSessions = sessions.filter((session) => session.is_active)
  const previousSessions = sessions.filter((session) => !session.is_active)

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to="/estudiante">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a mis cursos
      </Link>

      {locationState?.enrollmentStatus && (
        <Alert className="mt-4" title={locationState.enrollmentStatus === 'joined' ? 'Curso guardado' : 'Este curso ya estaba guardado'} tone="success">
          Ya puedes volver a sus clases y publicaciones desde Mis cursos.
        </Alert>
      )}

      <section className="relative mt-4 overflow-hidden rounded-[1.6rem] bg-[#071a2b] p-6 text-white shadow-[0_20px_60px_rgba(7,26,43,0.18)] sm:p-8 lg:p-10">
        <div className="absolute top-0 right-0 h-full w-2/5 bg-[radial-gradient(circle_at_top_right,rgba(49,92,246,0.4),transparent_66%)]" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-extrabold tracking-[0.16em] text-[#87eadc] uppercase">
            {course.subject}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {course.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            {course.description || 'Aquí encontrarás las clases y publicaciones que el profesor comparta con el curso.'}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-sm font-bold text-slate-200">
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4">
              <RadioTower className="size-4 text-[#66e2d1]" aria-hidden="true" />
              {activeSessions.length} {activeSessions.length === 1 ? 'clase en vivo' : 'clases en vivo'}
            </span>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4">
              <Clock3 className="size-4 text-[#66e2d1]" aria-hidden="true" />
              Te uniste {formatDateTime(course.joined_at)}
            </span>
          </div>
        </div>
      </section>

      {error && <Alert className="mt-5" tone="error">{error}</Alert>}

      {activeSessions.length > 0 && (
        <section className="mt-10" aria-labelledby="live-classes-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-emerald-700 uppercase">Ahora</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]" id="live-classes-title">
                En vivo
              </h2>
            </div>
            <Button className="min-h-10 px-3" onClick={() => void loadCourse()} variant="ghost">
              <RefreshCw className="size-4" aria-hidden="true" />
              Actualizar
            </Button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeSessions.map((session) => (
              <StudentClassCard key={session.session_id} session={session} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="previous-classes-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">Archivo del curso</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]" id="previous-classes-title">
              Clases anteriores
            </h2>
          </div>
          {activeSessions.length === 0 && (
            <Button className="min-h-10 px-3" onClick={() => void loadCourse()} variant="ghost">
              <RefreshCw className="size-4" aria-hidden="true" />
              Actualizar
            </Button>
          )}
        </div>

        {previousSessions.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon={<BookOpen className="size-5" aria-hidden="true" />} title="Todavía no hay clases anteriores">
              Cuando finalice una clase aparecerá aquí junto con el resumen o muro que publique el profesor.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previousSessions.map((session) => (
              <StudentClassCard key={session.session_id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
