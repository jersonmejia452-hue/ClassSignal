import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  KeyRound,
  LockKeyhole,
  PlayCircle,
  RadioTower,
  ScanLine,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert } from '../../components/ui/Alert'
import { Brand } from '../../components/ui/Brand'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { joinSessionSchema } from '../../schemas/joinSession'
import { getPublicSession } from '../../services/sessions.service'

export function JoinSessionPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLookingUp) return

    setLookupError(null)

    const result = joinSessionSchema.safeParse({ code })
    if (!result.success) {
      setCodeError(result.error.flatten().fieldErrors.code?.[0])
      return
    }

    setCode(result.data.code)
    setCodeError(undefined)
    setIsLookingUp(true)

    try {
      const session = await getPublicSession(result.data.code)

      if (!session) {
        setLookupError('No encontramos una clase con ese código. Revísalo con tu profesor e intenta de nuevo.')
        return
      }

      if (!session.is_active) {
        setLookupError('Esta clase ya no está recibiendo respuestas. Consulta con tu profesor si volverá a abrirse.')
        return
      }

      navigate(`/s/${session.code}`)
    } catch {
      setLookupError('No pudimos comprobar el código. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <main className="signal-shell min-h-screen bg-[#f4f7fb]">
      <header className="border-b border-white/10 bg-[#071a2b] text-white shadow-[0_8px_25px_rgba(7,26,43,0.12)]">
        <div className="mx-auto flex min-h-[4.75rem] max-w-2xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <div className="sm:hidden">
            <Brand compact inverse to="/unirse" />
          </div>
          <div className="hidden sm:block">
            <Brand inverse to="/unirse" />
          </div>
          <Link
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-extrabold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
            to="/profesor/login"
          >
            Acceso docente
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-10 sm:px-6 sm:py-14">
        <section aria-labelledby="join-title" className="text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-extrabold tracking-[0.12em] text-teal-800 uppercase">
            <RadioTower className="size-4" aria-hidden="true" />
            Participa en vivo
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#071a2b] sm:text-5xl" id="join-title">
            Entra a tu clase
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
            Escribe el código que compartió tu profesor. No necesitas una cuenta ni revelar tu nombre.
          </p>
        </section>

        <form
          className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(7,26,43,0.08)] sm:p-7"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold text-[#071a2b]">Código de acceso</h2>
              <p className="mt-0.5 text-sm text-slate-500">Son 6 letras o números.</p>
            </div>
          </div>

          <Field
            error={codeError}
            hint="Ejemplo: CALC24"
            htmlFor="session-code"
            label="Código de la clase"
          >
            <div className="relative">
              <ScanLine className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                aria-describedby={codeError ? 'session-code-error' : 'session-code-hint'}
                aria-invalid={Boolean(codeError)}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                className="form-input pl-12 font-mono text-xl font-black tracking-[0.18em] uppercase placeholder:font-sans placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:normal-case"
                disabled={isLookingUp}
                enterKeyHint="go"
                id="session-code"
                inputMode="text"
                maxLength={6}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase())
                  if (codeError) setCodeError(undefined)
                  if (lookupError) setLookupError(null)
                }}
                placeholder="Escribe el código"
                spellCheck={false}
                value={code}
              />
            </div>
          </Field>

          {lookupError && (
            <Alert className="mt-5" tone="error">
              {lookupError}
            </Alert>
          )}

          <Button className="mt-6" fullWidth isLoading={isLookingUp} type="submit">
            {isLookingUp ? 'Comprobando código' : 'Entrar a la clase'}
            {!isLookingUp && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
        </form>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
          <p>
            <strong>Tu participación es anónima.</strong> Este acceso no pide nombre, correo ni registro estudiantil.
          </p>
        </div>

        <Link
          className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-left text-sm font-extrabold text-[#071a2b] transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to="/demo"
        >
          <span className="inline-flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#071a2b] text-[#66e2d1]">
              <PlayCircle className="size-5" aria-hidden="true" />
            </span>
            <span>
              ¿No tienes código?
              <span className="mt-0.5 block text-xs font-semibold text-slate-600">
                Explora la demo guiada con una clase simulada.
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
        </Link>

        <Link
          className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-left text-sm font-extrabold text-[#071a2b] transition hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to="/estudiante/login"
        >
          <span className="inline-flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              ¿Quieres conservar tus cursos?
              <span className="mt-0.5 block text-xs font-semibold text-slate-600">
                Entra al portal estudiantil y consulta clases anteriores.
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
        </Link>

        <p className="mt-7 text-center text-sm text-slate-500">
          ¿Eres profesor?{' '}
          <Link className="font-extrabold text-blue-700 underline-offset-4 hover:underline" to="/profesor/login">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </main>
  )
}
