import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, RadioTower, ShieldCheck } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'

import { Alert } from '../../components/ui/Alert'
import { Brand } from '../../components/ui/Brand'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/cn'
import { getAuthErrorMessage } from '../../lib/errors'
import { authSchema } from '../../schemas/auth'
import {
  signInProfessor,
  signUpProfessor,
} from '../../services/auth.service'
import type { LoginLocationState } from '../../types/navigation'

type AuthMode = 'signin' | 'signup'

interface FormErrors {
  email?: string
  password?: string
}

export function LoginPage() {
  const { user, isLoading: isRestoringSession } = useAuth()
  const location = useLocation()
  const state = location.state as LoginLocationState | null
  const destination = state?.from?.pathname || '/profesor'

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isRestoringSession) return <LoadingScreen label="Comprobando tu acceso…" />
  if (user) return <Navigate to={destination} replace />

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setErrors({})
    setSubmitError(null)
    setConfirmationEmail(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setConfirmationEmail(null)

    const result = authSchema.safeParse({ email, password })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setErrors({
        email: fields.email?.[0],
        password: fields.password?.[0],
      })
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      if (mode === 'signin') {
        await signInProfessor(result.data)
      } else {
        const data = await signUpProfessor(result.data)
        if (!data.session) {
          setConfirmationEmail(result.data.email)
        }
      }
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] lg:grid lg:grid-cols-[minmax(34rem,1.08fr)_minmax(28rem,0.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#071a2b] text-white lg:flex lg:flex-col">
        <img
          alt="Docente usando ClassSignal con estudiantes universitarios durante una clase"
          className="absolute inset-0 size-full object-cover object-center"
          height="1400"
          src="/brand/classsignal-login-hero.png"
          width="1120"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,26,43,0.26)_0%,rgba(7,26,43,0.38)_34%,rgba(7,26,43,0.96)_100%)]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#071a2b]/70 to-transparent" aria-hidden="true" />

        <div className="relative z-10 flex h-full min-h-screen flex-col p-10 xl:p-14">
          <Brand inverse to="/profesor/login" />

          <div className="mt-auto max-w-2xl pb-4 pt-32">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#071a2b]/65 px-3 py-1.5 text-xs font-extrabold tracking-[0.13em] text-[#87eadc] uppercase backdrop-blur-md">
              <span className="size-2 rounded-full bg-[#34d6c1] shadow-[0_0_0_4px_rgba(52,214,193,0.14)]" aria-hidden="true" />
              Una señal en tiempo real
            </div>
            <h2 className="mt-6 max-w-xl text-5xl leading-[1.02] font-black tracking-[-0.05em] xl:text-6xl">
              Escucha lo que la clase aún no dice.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">
              ClassSignal convierte respuestas anónimas en una lectura clara de la comprensión, mientras todavía puedes actuar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-white">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#071a2b]/55 px-3.5 py-2.5 backdrop-blur-md">
                <ShieldCheck className="size-4 text-[#66e2d1]" aria-hidden="true" />
                Participación anónima
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#071a2b]/55 px-3.5 py-2.5 backdrop-blur-md">
                <RadioTower className="size-4 text-[#66e2d1]" aria-hidden="true" />
                Pulso en vivo
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center px-5 py-7 sm:px-8 sm:py-10 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <Brand to="/profesor/login" />
            <div className="relative mt-6 h-44 overflow-hidden rounded-[1.5rem] bg-[#071a2b] shadow-[0_18px_50px_rgba(7,26,43,0.18)]">
              <img
                alt=""
                className="size-full object-cover object-[center_38%]"
                height="360"
                src="/brand/classsignal-login-hero.png"
                width="720"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071a2b]/85 via-transparent to-transparent" aria-hidden="true" />
              <p className="absolute right-5 bottom-4 left-5 text-lg leading-6 font-black tracking-tight text-white">
                La señal de toda tu clase, en un solo lugar.
              </p>
            </div>
          </div>

          <p className="text-xs font-extrabold tracking-[0.16em] text-blue-700 uppercase">
            Espacio docente
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#071a2b] sm:text-4xl">
            {mode === 'signin' ? 'Vuelve a tus cursos' : 'Empieza con ClassSignal'}
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            {mode === 'signin'
              ? 'Entra para abrir una clase y ver sus señales en tiempo real.'
              : 'Crea tu cuenta docente y prepara tu primer curso.'}
          </p>

          <div className="mt-7 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1" role="group" aria-label="Tipo de acceso">
            {(['signin', 'signup'] as AuthMode[]).map((item) => (
              <button
                aria-pressed={mode === item}
                className={cn(
                  'min-h-11 rounded-xl px-3 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-blue-600',
                  mode === item
                    ? 'bg-white text-[#071a2b] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
                key={item}
                onClick={() => changeMode(item)}
                type="button"
              >
                {item === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {confirmationEmail ? (
            <div className="mt-7">
              <Alert title="Revisa tu correo" tone="success">
                Enviamos un enlace de confirmación a <strong>{confirmationEmail}</strong>. Después de confirmar, vuelve para iniciar sesión.
              </Alert>
              <Button className="mt-5" fullWidth onClick={() => changeMode('signin')} variant="secondary">
                Volver a iniciar sesión
              </Button>
            </div>
          ) : (
            <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
              {submitError && <Alert tone="error">{submitError}</Alert>}

              <Field error={errors.email} htmlFor="email" label="Correo electrónico">
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    className="form-input pl-12"
                    id="email"
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="docente@universidad.edu"
                    type="email"
                    value={email}
                  />
                </div>
              </Field>

              <Field error={errors.password} htmlFor="password" label="Contraseña">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    aria-invalid={Boolean(errors.password)}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    className="form-input pr-12 pl-12"
                    id="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              <Button fullWidth isLoading={isSubmitting} type="submit">
                {mode === 'signin' ? 'Entrar a mis cursos' : 'Crear cuenta docente'}
                {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>
          )}

          <p className="mt-7 flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden="true" />
            Supabase protege el acceso docente. Tus estudiantes participan sin crear una cuenta.
          </p>
        </div>
      </section>
    </main>
  )
}
