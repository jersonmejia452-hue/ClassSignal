import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, RadioTower } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../lib/errors'
import { sessionSchema } from '../../schemas/session'
import { createSession } from '../../services/sessions.service'

interface FormErrors {
  title?: string
  subject?: string
  topic?: string
}

export function NewSessionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const result = sessionSchema.safeParse({ title, subject, topic })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setErrors({
        title: fields.title?.[0],
        subject: fields.subject?.[0],
        topic: fields.topic?.[0],
      })
      return
    }

    if (!user) return
    setErrors({})
    setIsSubmitting(true)

    try {
      const session = await createSession(user.id, result.data)
      navigate(`/profesor/sesion/${session.id}`, {
        replace: true,
        state: { justCreated: true },
      })
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, 'No pudimos crear la sesión. Intenta de nuevo.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to="/profesor">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a sesiones
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
            Nueva sesión
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Prepara el pulso de tu clase
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Estos datos ayudan a que el estudiante confirme que entró a la sesión correcta.
          </p>

          <form className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" noValidate onSubmit={handleSubmit}>
            {submitError && <Alert tone="error">{submitError}</Alert>}

            <Field error={errors.title} htmlFor="title" label="Título de la sesión" hint="Un nombre corto para reconocer esta clase en tu panel.">
              <input
                aria-describedby={errors.title ? 'title-error' : 'title-hint'}
                aria-invalid={Boolean(errors.title)}
                autoFocus
                className="form-input"
                id="title"
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Clase 4 · Límites laterales"
                value={title}
              />
            </Field>

            <Field error={errors.subject} htmlFor="subject" label="Materia">
              <input
                aria-describedby={errors.subject ? 'subject-error' : undefined}
                aria-invalid={Boolean(errors.subject)}
                className="form-input"
                id="subject"
                maxLength={80}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ej. Cálculo diferencial"
                value={subject}
              />
            </Field>

            <Field
              error={errors.topic}
              hint="Describe la idea concreta que quieres comprobar durante esta sesión."
              htmlFor="topic"
              label="Tema"
            >
              <textarea
                aria-describedby={errors.topic ? 'topic-error' : 'topic-hint'}
                aria-invalid={Boolean(errors.topic)}
                className="form-input min-h-28 resize-y py-3"
                id="topic"
                maxLength={120}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ej. Cómo calcular límites cuando x se acerca por la izquierda o la derecha"
                value={topic}
              />
            </Field>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100" to="/profesor">
                Cancelar
              </Link>
              <Button isLoading={isSubmitting} type="submit">
                Crear sesión
                {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          </form>
        </section>

        <aside className="rounded-2xl bg-[#0b1830] p-6 text-white shadow-sm lg:sticky lg:top-6">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-blue-100">
            <RadioTower className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-lg font-extrabold">Qué ocurrirá después</h2>
          <ol className="mt-5 space-y-5">
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-blue-200" aria-hidden="true" />
              <p className="text-sm leading-6 text-slate-300">Recibirás un código corto y un QR listo para proyectar.</p>
            </li>
            <li className="flex gap-3">
              <BookOpenText className="mt-0.5 size-5 shrink-0 text-blue-200" aria-hidden="true" />
              <p className="text-sm leading-6 text-slate-300">Los estudiantes responderán sin crear cuenta ni compartir su nombre.</p>
            </li>
            <li className="flex gap-3">
              <RadioTower className="mt-0.5 size-5 shrink-0 text-blue-200" aria-hidden="true" />
              <p className="text-sm leading-6 text-slate-300">El resumen y las dudas se actualizarán en tiempo real.</p>
            </li>
          </ol>
        </aside>
      </div>
    </div>
  )
}
