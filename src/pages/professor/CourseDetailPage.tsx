import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, CalendarPlus2, Plus, RadioTower, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { SessionCard } from '../../components/sessions/SessionCard'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { getErrorMessage } from '../../lib/errors'
import { getCourseById } from '../../services/courses.service'
import { getSessionsByCourse } from '../../services/sessions.service'
import type { ClassSession, Course } from '../../types/domain'

interface CourseLocationState {
  justCreated?: boolean
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const location = useLocation()
  const locationState = location.state as CourseLocationState | null
  const [course, setCourse] = useState<Course | null>(null)
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCourse = useCallback(async () => {
    if (!courseId) {
      setError('El curso solicitado no es válido.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [courseResult, sessionResult] = await Promise.all([
        getCourseById(courseId),
        getSessionsByCourse(courseId),
      ])
      setCourse(courseResult)
      setSessions(sessionResult)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No pudimos cargar este curso.'))
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadCourse()
  }, [loadCourse])

  if (isLoading) {
    return (
      <div aria-label="Cargando curso" className="animate-pulse" role="status">
        <div className="h-5 w-36 rounded bg-slate-200" />
        <div className="mt-5 h-64 rounded-[1.4rem] bg-[#dfe6ef]" />
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
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b]" to="/profesor">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a mis cursos
        </Link>
        <div className="mt-6">
          <EmptyState icon={<BookOpen className="size-5" aria-hidden="true" />} title="No encontramos este curso">
            {error || 'Puede que haya sido eliminado o pertenezca a otra cuenta docente.'}
          </EmptyState>
        </div>
      </div>
    )
  }

  const activeCount = sessions.filter((session) => session.is_active).length

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to="/profesor">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a mis cursos
      </Link>

      {locationState?.justCreated && (
        <Alert className="mt-4" title="Curso creado" tone="success">
          El espacio está listo. Ahora crea la primera clase para generar su código y QR.
        </Alert>
      )}

      <section className="relative mt-4 overflow-hidden rounded-[1.6rem] bg-[#071a2b] p-6 text-white shadow-[0_20px_60px_rgba(7,26,43,0.18)] sm:p-8 lg:p-10">
        <div className="absolute top-0 right-0 h-full w-2/5 bg-[radial-gradient(circle_at_top_right,rgba(49,92,246,0.38),transparent_66%)]" aria-hidden="true" />
        <div className="absolute right-8 bottom-0 flex h-32 items-end gap-2 opacity-35" aria-hidden="true">
          {[46, 78, 58, 96, 69, 112, 82].map((height, index) => (
            <span className="w-2 rounded-t-full bg-[#66e2d1]" key={`${height}-${index}`} style={{ height }} />
          ))}
        </div>

        <div className="relative max-w-3xl">
          <p className="text-xs font-extrabold tracking-[0.16em] text-[#87eadc] uppercase">
            {course.subject}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {course.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            {course.description || 'Un espacio para organizar las clases y leer las señales de comprensión del grupo.'}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#66e2d1] px-5 py-3 text-sm font-extrabold text-[#071a2b] shadow-sm transition hover:bg-[#87eadc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" to={`/profesor/curso/${course.id}/sesion/nueva`}>
              <Plus className="size-4" aria-hidden="true" />
              Crear una clase
            </Link>
            <p className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-200">
              <RadioTower className="size-4 text-[#66e2d1]" aria-hidden="true" />
              {activeCount} {activeCount === 1 ? 'clase activa' : 'clases activas'}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-9" aria-labelledby="course-classes-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
              Historial del curso
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]" id="course-classes-title">
              Clases y señales
            </h2>
          </div>
          {sessions.length > 0 && (
            <Button className="min-h-10 px-3" onClick={() => void loadCourse()} variant="ghost">
              <RefreshCw className="size-4" aria-hidden="true" />
              Actualizar
            </Button>
          )}
        </div>

        {error && <Alert className="mt-5" tone="error">{error}</Alert>}

        {sessions.length === 0 && !error ? (
          <div className="mt-5">
            <EmptyState
              action={(
                <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#315cf6] px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#254bd4]" to={`/profesor/curso/${course.id}/sesion/nueva`}>
                  <Plus className="size-4" aria-hidden="true" />
                  Crear la primera clase
                </Link>
              )}
              icon={<CalendarPlus2 className="size-5" aria-hidden="true" />}
              title="Este curso todavía no tiene clases"
            >
              Crea una clase cuando quieras medir la comprensión del grupo. ClassSignal generará un enlace y un QR para tus estudiantes.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
