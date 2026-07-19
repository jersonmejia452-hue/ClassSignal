import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpenCheck, Plus, RadioTower, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StudentCourseCard } from '../../components/student/StudentCourseCard'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'
import { listMyStudentCourses } from '../../services/studentPortal.service'
import type { StudentCourse } from '../../types/domain'

export function StudentDashboardPage() {
  const { user, profile } = useAuth()
  const [courses, setCourses] = useState<StudentCourse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const loadCourses = useCallback(async () => {
    const nextRequestId = requestId.current + 1
    requestId.current = nextRequestId

    if (!user) {
      setCourses([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await listMyStudentCourses()
      if (requestId.current !== nextRequestId) return
      setCourses(result)
    } catch {
      if (requestId.current !== nextRequestId) return
      setError('No pudimos cargar tus cursos. Revisa tu conexión e intenta nuevamente.')
    } finally {
      if (requestId.current === nextRequestId) setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadCourses()
    return () => {
      requestId.current += 1
    }
  }, [loadCourses])

  const activeSessionCount = courses.reduce(
    (total, course) => total + course.active_session_count,
    0,
  )
  const studentName = profile?.display_name?.trim()
    || user?.email?.split('@')[0]
    || 'estudiante'

  return (
    <div>
      <section className="relative overflow-hidden rounded-[1.65rem] bg-[#071a2b] px-6 py-7 text-white shadow-[0_22px_65px_rgba(7,26,43,0.18)] sm:px-8 sm:py-9 lg:px-10">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(49,92,246,0.42),transparent_62%)]" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-extrabold tracking-[0.16em] text-[#87eadc] uppercase">
            Portal del estudiante · {studentName}
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-black tracking-[-0.04em] sm:text-5xl">
            Tus cursos, siempre a mano.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Vuelve a cada clase, consulta lo que publicó tu profesor y entra a las sesiones que estén en vivo.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#66e2d1] px-5 py-3 text-sm font-extrabold text-[#071a2b] transition hover:bg-[#87eadc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" to="/estudiante/unirse">
              <Plus className="size-4" aria-hidden="true" />
              Unirme a un curso
            </Link>
            {!isLoading && (
              <div className="flex min-h-12 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-slate-200">
                <span>{courses.length} {courses.length === 1 ? 'curso' : 'cursos'}</span>
                <span className="h-5 w-px bg-white/15" aria-hidden="true" />
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  {activeSessionCount} en vivo
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-9" aria-labelledby="student-courses-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
              Tu archivo académico
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]" id="student-courses-title">
              Mis cursos
            </h2>
          </div>
          {!isLoading && courses.length > 0 && (
            <Button className="min-h-10 px-3" onClick={() => void loadCourses()} variant="ghost">
              <RefreshCw className="size-4" aria-hidden="true" />
              Actualizar
            </Button>
          )}
        </div>

        {error && (
          <Alert className="mt-5" tone="error">
            {error}{' '}
            <button className="font-extrabold underline underline-offset-2" onClick={() => void loadCourses()} type="button">
              Reintentar
            </button>
          </Alert>
        )}

        {isLoading ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Cargando cursos" role="status">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="h-72 animate-pulse rounded-[1.4rem] border border-slate-200 bg-white" key={index} />
            ))}
          </div>
        ) : courses.length === 0 && !error ? (
          <div className="mt-5">
            <EmptyState
              action={(
                <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#315cf6] px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#254bd4]" to="/estudiante/unirse">
                  <Plus className="size-4" aria-hidden="true" />
                  Unirme a mi primer curso
                </Link>
              )}
              icon={<BookOpenCheck className="size-5" aria-hidden="true" />}
              title="Todavía no tienes cursos guardados"
            >
              Pídele a tu profesor el código permanente del curso. Después podrás volver a sus clases desde este panel.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <StudentCourseCard course={course} key={course.course_id} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm leading-6 text-teal-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
          <p><strong>Tu matrícula guarda acceso, no respuestas.</strong> Las opiniones en vivo siguen viajando por un canal anónimo separado.</p>
        </div>
        <Link className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950 transition hover:border-blue-200" to="/unirse">
          <RadioTower className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
          <p><strong>¿Tienes un código de clase?</strong> También puedes participar una sola vez sin guardar el curso.</p>
        </Link>
      </div>
    </div>
  )
}
