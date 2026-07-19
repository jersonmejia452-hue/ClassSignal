import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Mail,
  RadioTower,
  ShieldCheck,
} from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { Alert } from '../../components/ui/Alert'
import { Brand } from '../../components/ui/Brand'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { useAuth } from '../../context/AuthContext'
import { getStudentAuthErrorMessage } from '../../lib/errors'
import { studentAuthSchema } from '../../schemas/studentAuth'
import {
  getSafeStudentRedirectPath,
  signInStudentWithMagicLink,
} from '../../services/auth.service'

export function StudentLoginPage() {
  const { user, role, isLoading, profileError, signOut } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const from = (location.state as {
    from?: { pathname?: unknown; search?: unknown }
  } | null)?.from
  const requestedPath = typeof from?.pathname === 'string'
    ? `${from.pathname}${typeof from.search === 'string' ? from.search : ''}`
    : null
  const redirectPath = getSafeStudentRedirectPath(requestedPath)

  if (isLoading) return <LoadingScreen label="Comprobando tu acceso…" />
  if (user && role === 'student') return <Navigate replace to={redirectPath} />
  if (user && role === 'professor') return <Navigate replace to="/profesor" />

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setSubmitError(null)
    setConfirmationEmail(null)

    const result = studentAuthSchema.safeParse({ email })
    if (!result.success) {
      setEmailError(result.error.flatten().fieldErrors.email?.[0])
      return
    }

    setEmail(result.data.email)
    setEmailError(undefined)
    setIsSubmitting(true)

    try {
      await signInStudentWithMagicLink(result.data, redirectPath)
      setConfirmationEmail(result.data.email)
    } catch (error) {
      setSubmitError(getStudentAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setSubmitError(null)

    try {
      await signOut()
    } catch {
      setSubmitError('No pudimos cerrar la sesión. Intenta nuevamente.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="signal-shell min-h-screen bg-[#f4f7fb]">
      <header className="border-b border-white/10 bg-[#071a2b] text-white">
        <div className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Brand inverse to="/estudiante/login" />
          <Link
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-extrabold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            to="/unirse"
          >
            Entrar con código de clase
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.82fr)] lg:items-center lg:gap-12">
        <section className="relative overflow-hidden rounded-[1.7rem] bg-[#071a2b] p-7 text-white shadow-[0_24px_70px_rgba(7,26,43,0.2)] sm:p-10">
          <div className="absolute inset-y-0 right-0 w-3/5 bg-[radial-gradient(circle_at_top_right,rgba(49,92,246,0.48),transparent_64%)]" aria-hidden="true" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-extrabold tracking-[0.13em] text-[#87eadc] uppercase">
              <BookOpenCheck className="size-4" aria-hidden="true" />
              Portal del estudiante
            </span>
            <h1 className="mt-6 max-w-xl text-4xl leading-tight font-black tracking-[-0.045em] sm:text-5xl">
              Tus cursos y clases, siempre a mano.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Guarda tus cursos, vuelve al historial y consulta los resúmenes y muros que publique tu profesor.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <RadioTower className="size-5 text-[#66e2d1]" aria-hidden="true" />
                <p className="mt-3 text-sm font-extrabold">Participa en vivo</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  La señal de comprensión se envía por el canal anónimo de siempre.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <ShieldCheck className="size-5 text-[#66e2d1]" aria-hidden="true" />
                <p className="mt-3 text-sm font-extrabold">Identidad separada</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Tu cuenta guarda matrículas, no quién envió cada opinión o duda.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="student-login-title" className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(7,26,43,0.08)] sm:p-8">
          <p className="text-xs font-extrabold tracking-[0.15em] text-blue-700 uppercase">
            Mis cursos
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#071a2b]" id="student-login-title">
            Entra con tu correo
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Te enviaremos un enlace de un solo uso. No necesitas crear ni recordar una contraseña.
          </p>

          {user && !role ? (
            <div className="mt-7">
              <Alert title="No pudimos verificar tu perfil" tone="error">
                {profileError
                  ? 'Tu sesión existe, pero el perfil no está disponible. Cierra sesión y solicita un enlace nuevo.'
                  : 'Estamos esperando la información de tu perfil. Si el problema continúa, vuelve a iniciar sesión.'}
              </Alert>
              {submitError && <Alert className="mt-4" tone="error">{submitError}</Alert>}
              <Button className="mt-5" fullWidth isLoading={isSigningOut} onClick={() => void handleSignOut()} variant="secondary">
                Cerrar sesión y volver a intentar
              </Button>
            </div>
          ) : confirmationEmail ? (
            <div className="mt-7">
              <Alert title="Revisa tu correo" tone="success">
                Enviamos el enlace de acceso a <strong>{confirmationEmail}</strong>. Puedes cerrar esta pestaña después de abrirlo.
              </Alert>
              <Button
                className="mt-5"
                fullWidth
                onClick={() => {
                  setConfirmationEmail(null)
                  setSubmitError(null)
                }}
                variant="secondary"
              >
                Usar otro correo
              </Button>
            </div>
          ) : (
            <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
              {submitError && <Alert tone="error">{submitError}</Alert>}

              <Field error={emailError} htmlFor="student-email" label="Correo electrónico">
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    aria-describedby={emailError ? 'student-email-error' : undefined}
                    aria-invalid={Boolean(emailError)}
                    autoComplete="email"
                    className="form-input pl-12"
                    disabled={isSubmitting}
                    id="student-email"
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="estudiante@universidad.edu"
                    type="email"
                    value={email}
                  />
                </div>
              </Field>

              <Button fullWidth isLoading={isSubmitting} type="submit">
                Enviarme el enlace
                {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿Solo quieres responder una clase?{' '}
            <Link className="font-extrabold text-blue-700 underline-offset-4 hover:underline" to="/unirse">
              Entra sin cuenta
            </Link>
          </p>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">
            ¿Eres profesor?{' '}
            <Link className="font-bold text-slate-700 underline-offset-4 hover:underline" to="/profesor/login">
              Acceso docente
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
