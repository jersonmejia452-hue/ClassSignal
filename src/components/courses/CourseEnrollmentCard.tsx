import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, DoorOpen, LockKeyhole, UsersRound } from 'lucide-react'

import type { Course } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

interface CourseEnrollmentCardProps {
  course: Course
  enrollmentCount: number | null
  error?: string | null
  onEnrollmentOpenChange: (nextOpen: boolean) => Promise<unknown>
}

export function CourseEnrollmentCard({
  course,
  enrollmentCount,
  error = null,
  onEnrollmentOpenChange,
}: CourseEnrollmentCardProps) {
  const titleId = useId()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(course.enrollment_code)
      setCopyState('copied')
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => {
        setCopyState('idle')
        resetTimer.current = null
      }, 2200)
    } catch {
      setCopyState('error')
    }
  }

  const toggleEnrollment = async () => {
    const nextOpen = !course.enrollment_open
    setActionError(null)
    setIsUpdating(true)

    try {
      await onEnrollmentOpenChange(nextOpen)
    } catch {
      setActionError(
        nextOpen
          ? 'No pudimos abrir la matrícula. Intenta de nuevo.'
          : 'No pudimos cerrar la matrícula. Intenta de nuevo.',
      )
    } finally {
      setIsUpdating(false)
    }
  }

  const displayedError = error || actionError

  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <UsersRound className="size-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-slate-950" id={titleId}>
            Acceso permanente al curso
          </h2>
        </div>
        <span
          className={course.enrollment_open
            ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700'
            : 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600'}
        >
          <span
            className={`size-1.5 rounded-full ${course.enrollment_open ? 'bg-emerald-500' : 'bg-slate-400'}`}
            aria-hidden="true"
          />
          Matrícula {course.enrollment_open ? 'abierta' : 'cerrada'}
        </span>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)] lg:items-center">
        <div>
          <p className="text-xs font-extrabold tracking-[0.13em] text-slate-500 uppercase">
            Código del curso
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-3xl font-black tracking-[0.16em] text-slate-950 sm:text-4xl">
              {course.enrollment_code}
            </p>
            <Button
              aria-label={copyState === 'copied' ? 'Código copiado' : 'Copiar código del curso'}
              className="min-h-10 px-3"
              onClick={() => void copyCode()}
              variant="secondary"
            >
              {copyState === 'copied' ? (
                <Check className="size-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copyState === 'copied' ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Compártelo una sola vez. El estudiante podrá guardar este curso en su portal sin que sus señales anónimas revelen su identidad.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-slate-950" aria-live="polite">
            <UsersRound className="size-4 text-blue-700" aria-hidden="true" />
            {enrollmentCount === null
              ? 'Conteo no disponible'
              : `${enrollmentCount} ${enrollmentCount === 1 ? 'estudiante inscrito' : 'estudiantes inscritos'}`}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {course.enrollment_open
              ? 'Los estudiantes pueden unirse ahora con el código del curso.'
              : 'Los estudiantes ya inscritos conservan el acceso. No se aceptan nuevas matrículas.'}
          </p>
          <Button
            aria-checked={course.enrollment_open}
            className="mt-4 w-full"
            isLoading={isUpdating}
            onClick={() => void toggleEnrollment()}
            role="switch"
            variant={course.enrollment_open ? 'secondary' : 'primary'}
          >
            {course.enrollment_open ? (
              <LockKeyhole className="size-4" aria-hidden="true" />
            ) : (
              <DoorOpen className="size-4" aria-hidden="true" />
            )}
            {course.enrollment_open ? 'Cerrar matrícula' : 'Abrir matrícula'}
          </Button>
        </div>
      </div>

      {(copyState === 'error' || displayedError) && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert tone="error">
            {displayedError || 'No pudimos copiar el código. Selecciónalo y cópialo manualmente.'}
          </Alert>
        </div>
      )}
    </section>
  )
}
