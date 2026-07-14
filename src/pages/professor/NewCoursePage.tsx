import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, Layers3, RadioTower } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../lib/errors'
import { courseSchema } from '../../schemas/course'
import { createCourse } from '../../services/courses.service'

interface FormErrors {
  name?: string
  subject?: string
  description?: string
}

export function NewCoursePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const result = courseSchema.safeParse({ name, subject, description })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setErrors({
        name: fields.name?.[0],
        subject: fields.subject?.[0],
        description: fields.description?.[0],
      })
      return
    }

    if (!user) return
    setErrors({})
    setIsSubmitting(true)

    try {
      const course = await createCourse(user.id, result.data)
      navigate(`/profesor/curso/${course.id}`, {
        replace: true,
        state: { justCreated: true },
      })
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, 'No pudimos crear el curso. Intenta de nuevo.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-[#071a2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to="/profesor">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a mis cursos
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <section>
          <p className="text-xs font-extrabold tracking-[0.15em] text-blue-700 uppercase">
            Nuevo curso
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.035em] text-[#071a2b] sm:text-4xl">
            Crea el espacio de una materia
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Cada curso reúne sus clases, códigos de acceso y señales de comprensión en un solo lugar.
          </p>

          <form className="mt-8 space-y-6 rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(7,26,43,0.06)] sm:p-7" noValidate onSubmit={handleSubmit}>
            {submitError && <Alert tone="error">{submitError}</Alert>}

            <Field error={errors.name} htmlFor="course-name" label="Nombre del curso" hint="El nombre que reconocerás en tu panel docente.">
              <input
                aria-describedby={errors.name ? 'course-name-error' : 'course-name-hint'}
                aria-invalid={Boolean(errors.name)}
                autoFocus
                className="form-input"
                id="course-name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Cálculo I · Grupo 02"
                value={name}
              />
            </Field>

            <Field error={errors.subject} htmlFor="course-subject" label="Materia">
              <input
                aria-describedby={errors.subject ? 'course-subject-error' : undefined}
                aria-invalid={Boolean(errors.subject)}
                className="form-input"
                id="course-subject"
                maxLength={80}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ej. Cálculo diferencial"
                value={subject}
              />
            </Field>

            <Field error={errors.description} htmlFor="course-description" label="Descripción" hint="Opcional. Puedes indicar el grupo, semestre u objetivo general.">
              <textarea
                aria-describedby={errors.description ? 'course-description-error' : 'course-description-hint'}
                aria-invalid={Boolean(errors.description)}
                className="form-input min-h-28 resize-y py-3"
                id="course-description"
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ej. Curso de primer semestre para Ingeniería, grupo de la mañana."
                value={description}
              />
            </Field>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100" to="/profesor">
                Cancelar
              </Link>
              <Button isLoading={isSubmitting} type="submit">
                Crear curso
                {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          </form>
        </section>

        <aside className="relative overflow-hidden rounded-[1.4rem] bg-[#071a2b] p-6 text-white shadow-[0_18px_50px_rgba(7,26,43,0.18)] lg:sticky lg:top-28">
          <div className="absolute -right-10 -bottom-12 size-40 rounded-full border border-white/10" aria-hidden="true" />
          <span className="grid size-12 place-items-center rounded-2xl bg-[#66e2d1] text-[#071a2b]">
            <BookOpenCheck className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-black tracking-tight">Una estructura sencilla</h2>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <Layers3 className="size-5 shrink-0 text-[#66e2d1]" aria-hidden="true" />
              <p className="text-sm font-bold">1 curso organiza varias clases</p>
            </div>
            <div className="ml-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <RadioTower className="size-5 shrink-0 text-[#66e2d1]" aria-hidden="true" />
              <p className="text-sm font-bold">Cada clase recibe señales en vivo</p>
            </div>
          </div>
          <p className="relative mt-6 text-sm leading-6 text-slate-300">
            Tus estudiantes seguirán entrando con un código o QR, sin cuenta y sin compartir su nombre.
          </p>
        </aside>
      </div>
    </div>
  )
}
