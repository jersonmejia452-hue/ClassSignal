import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
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
        navigate(destination, { replace: true })
      } else {
        const data = await signUpProfessor(result.data)
        if (data.session) {
          navigate('/profesor', { replace: true })
        } else {
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
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[#0b1830] p-12 text-white lg:flex lg:min-h-screen lg:flex-col xl:p-16">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-blue-600/15 blur-3xl" aria-hidden="true" />
        <div className="absolute right-[-8rem] bottom-[-8rem] size-96 rounded-full border border-white/10" aria-hidden="true" />
        <Brand inverse to="/profesor/login" />

        <div className="relative my-auto max-w-xl py-16">
          <p className="text-xs font-extrabold tracking-[0.17em] text-blue-200 uppercase">
            Para docentes
          </p>
          <h2 className="mt-5 text-5xl leading-[1.05] font-black tracking-[-0.045em] xl:text-6xl">
            Escucha a toda la clase, incluso cuando nadie levanta la mano.
          </h2>
          <p className="mt-7 max-w-lg text-lg leading-8 text-slate-300">
            Recoge señales anónimas de comprensión y dudas en tiempo real para decidir qué explicar a continuación.
          </p>

          <div className="mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <ShieldCheck className="size-5 text-blue-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold">Participación sin presión</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Sin cuentas ni nombres para estudiantes.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <ArrowRight className="size-5 text-blue-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold">Una señal accionable</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Comprensión visible mientras la clase sucede.</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs font-semibold tracking-wide text-slate-500">
          OpenAI Build Week · MVP educativo
        </p>
      </section>

      <section className="flex min-h-screen items-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Brand to="/profesor/login" />
          </div>

          <p className="text-xs font-extrabold tracking-[0.15em] text-blue-700 uppercase">
            Acceso docente
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {mode === 'signin' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            {mode === 'signin'
              ? 'Entra para crear una sesión o revisar el pulso de tu clase.'
              : 'Usa tu correo para empezar a recoger dudas anónimas.'}
          </p>

          <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Tipo de acceso">
            {(['signin', 'signup'] as AuthMode[]).map((item) => (
              <button
                aria-pressed={mode === item}
                className={cn(
                  'min-h-11 rounded-lg px-3 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-blue-600',
                  mode === item
                    ? 'bg-white text-slate-950 shadow-sm'
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
                {mode === 'signin' ? 'Entrar al panel' : 'Crear cuenta docente'}
                {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>
          )}

          <p className="mt-7 text-center text-xs leading-5 text-slate-500">
            El acceso docente se protege con Supabase Auth. Los estudiantes nunca necesitan una cuenta.
          </p>
        </div>
      </section>
    </main>
  )
}
