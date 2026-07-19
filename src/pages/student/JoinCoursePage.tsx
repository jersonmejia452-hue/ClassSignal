import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, KeyRound, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { studentEnrollmentSchema } from '../../schemas/studentEnrollment'
import { enrollInCourse } from '../../services/studentPortal.service'

export function JoinCoursePage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setSubmitError(null)
    const result = studentEnrollmentSchema.safeParse({ code })

    if (!result.success) {
      setCodeError(result.error.flatten().fieldErrors.code?.[0])
      return
    }

    setCode(result.data.code)
    setCodeError(undefined)
    setIsSubmitting(true)

    try {
      const enrollment = await enrollInCourse(result.data.code)
      if (!isMountedRef.current) return
      navigate(`/estudiante/curso/${enrollment.course_id}`, {
        replace: true,
        state: { enrollmentStatus: enrollment.enrollment_status },
      })
    } catch {
      if (!isMountedRef.current) return
      setSubmitError(
        'No pudimos guardar ese curso. Revisa el código con tu profesor e intenta nuevamente.',
      )
    } finally {
      if (isMountedRef.current) setIsSubmitting(false)
    }
  }

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to="/estudiante">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a mis cursos
      </Link>

      <div className="mx-auto mt-5 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <section aria-labelledby="join-course-title" className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(7,26,43,0.075)] sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
            Matrícula del curso
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#071a2b] sm:text-4xl" id="join-course-title">
            Guarda un curso en tu panel
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Usa el código permanente que compartió tu profesor. Es diferente del código que se proyecta para responder una clase en vivo.
          </p>

          <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
            {submitError && <Alert tone="error">{submitError}</Alert>}

            <Field
              error={codeError}
              hint="Son 8 caracteres en mayúscula."
              htmlFor="course-enrollment-code"
              label="Código del curso"
            >
              <input
                aria-describedby={codeError ? 'course-enrollment-code-error' : 'course-enrollment-code-hint'}
                aria-invalid={Boolean(codeError)}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                className="form-input font-mono text-xl font-black tracking-[0.2em] uppercase"
                disabled={isSubmitting}
                id="course-enrollment-code"
                maxLength={8}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="AULA24XZ"
                spellCheck={false}
                value={code}
              />
            </Field>

            <Button fullWidth isLoading={isSubmitting} type="submit">
              Guardar en Mis cursos
              {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </form>
        </section>

        <aside className="relative overflow-hidden rounded-[1.5rem] bg-[#071a2b] p-6 text-white shadow-[0_18px_50px_rgba(7,26,43,0.16)]">
          <div className="absolute -right-12 -bottom-12 size-40 rounded-full border border-white/10" aria-hidden="true" />
          <BookOpenCheck className="size-6 text-[#66e2d1]" aria-hidden="true" />
          <h2 className="mt-5 text-xl font-black tracking-tight">Un código, todo el curso</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Después de inscribirte verás las clases activas, los resúmenes publicados y el muro histórico que el profesor decida compartir.
          </p>
          <div className="relative mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#66e2d1]" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-200">
              Inscribirte no vincula tu cuenta con las respuestas anónimas de cada pulso.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
