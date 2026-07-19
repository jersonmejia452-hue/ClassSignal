import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, MessageSquareText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { PublicQuestionWall } from '../../components/questions/PublicQuestionWall'
import { StatusSelector } from '../../components/responses/StatusSelector'
import {
  InvisibleTurnstile,
  type InvisibleTurnstileHandle,
} from '../../components/security/InvisibleTurnstile'
import { Alert } from '../../components/ui/Alert'
import { Brand } from '../../components/ui/Brand'
import { Button } from '../../components/ui/Button'
import { useAnonymousId } from '../../hooks/useAnonymousId'
import { usePublicQuestionWall } from '../../hooks/usePublicQuestionWall'
import { getErrorCode, getErrorMessage } from '../../lib/errors'
import { statusContent } from '../../lib/format'
import { responseSchema } from '../../schemas/response'
import {
  getResponseSubmissionSecurity,
  submitStudentResponse,
} from '../../services/responses.service'
import { getPublicSession } from '../../services/sessions.service'
import type {
  PublicClassSession,
  ResponseSubmissionSecurity,
  UnderstandingStatus,
} from '../../types/domain'
import type { TurnstileStatus } from '../../types/turnstile'

interface FormErrors {
  status?: string
  questionText?: string
}

const publicSessionPollingIntervalMs = 5_000
const pulseSubmissionStoragePrefix = 'classsignal:pulse-submitted:v1:'

function hasSubmittedPulse(pulseId: string) {
  try {
    return window.localStorage.getItem(
      `${pulseSubmissionStoragePrefix}${pulseId}`,
    ) === '1'
  } catch {
    return false
  }
}

function rememberSubmittedPulse(pulseId: string) {
  try {
    window.localStorage.setItem(`${pulseSubmissionStoragePrefix}${pulseId}`, '1')
  } catch {
    // The in-memory confirmation still works when storage is unavailable.
  }
}

export function StudentSessionPage() {
  const { code = '' } = useParams<{ code: string }>()
  const anonymousId = useAnonymousId()
  const turnstileRef = useRef<InvisibleTurnstileHandle>(null)
  const refreshSessionRef = useRef<() => Promise<void>>(async () => undefined)
  const observedSessionIdRef = useRef<string | null>(null)
  const observedPulseIdRef = useRef<string | null>(null)
  const observedSessionActiveRef = useRef<boolean | null>(null)
  const activePulseIdRef = useRef<string | null>(null)
  const [session, setSession] = useState<PublicClassSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [submissionSecurity, setSubmissionSecurity] = useState<ResponseSubmissionSecurity | null>(null)
  const [isSecurityLoading, setIsSecurityLoading] = useState(true)
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>('loading')
  const [status, setStatus] = useState<UnderstandingStatus | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [submittedStatus, setSubmittedStatus] = useState<UnderstandingStatus | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [pulseAnnouncement, setPulseAnnouncement] = useState('')
  const questionWall = usePublicQuestionWall(
    session?.id,
    session?.active_pulse_id ?? undefined,
  )

  useEffect(() => {
    let isMounted = true
    let isRequestInFlight = false
    let hasCompletedInitialLoad = false

    setSession(null)
    setStatus(null)
    setQuestionText('')
    setSubmittedStatus(null)
    setErrors({})
    setSubmitError(null)
    setIsSubmitting(false)
    setIsSubmitted(false)
    setPulseAnnouncement('')
    setIsLoading(true)
    setLoadError(null)
    setRefreshError(null)
    setSubmissionSecurity(null)
    setIsSecurityLoading(true)
    setSecurityError(null)
    setTurnstileStatus('loading')
    observedSessionIdRef.current = null
    observedPulseIdRef.current = null
    observedSessionActiveRef.current = null
    activePulseIdRef.current = null

    const refreshSession = async () => {
      if (isRequestInFlight) return
      isRequestInFlight = true

      try {
        const publicSession = await getPublicSession(code)
        if (!isMounted) return

        setSession(publicSession)
        setLoadError(null)
        setRefreshError(null)
      } catch (error) {
        if (!isMounted) return

        const message = getErrorMessage(error, 'No pudimos abrir esta clase.')
        if (hasCompletedInitialLoad) {
          setRefreshError(
            'No pudimos comprobar si hay un pulso nuevo. Conservamos la última información disponible.',
          )
        } else {
          setLoadError(message)
        }
      } finally {
        if (isMounted && !hasCompletedInitialLoad) {
          hasCompletedInitialLoad = true
          setIsLoading(false)
        }
        isRequestInFlight = false
      }
    }

    refreshSessionRef.current = refreshSession
    void refreshSession()

    const intervalId = window.setInterval(() => {
      void refreshSession()
    }, publicSessionPollingIntervalMs)

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshSession()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      refreshSessionRef.current = async () => undefined
    }
  }, [code])

  useEffect(() => {
    if (!session) {
      activePulseIdRef.current = null
      return
    }

    const nextPulseId = session.active_pulse_id
    const previousSessionId = observedSessionIdRef.current
    const previousPulseId = observedPulseIdRef.current
    const previousSessionActive = observedSessionActiveRef.current
    const isNewSession = previousSessionId !== session.id
    const pulseChanged = !isNewSession && previousPulseId !== nextPulseId
    const sessionStateChanged = !isNewSession
      && previousSessionActive !== session.is_active

    activePulseIdRef.current = nextPulseId

    if (isNewSession || pulseChanged || sessionStateChanged) {
      setStatus(null)
      setQuestionText('')
      setSubmittedStatus(null)
      setErrors({})
      setSubmitError(null)
      setIsSubmitting(false)
      setTurnstileStatus('loading')

      const wasAlreadySubmitted = nextPulseId
        ? hasSubmittedPulse(nextPulseId)
        : false
      setIsSubmitted(wasAlreadySubmitted)

      if (isNewSession) {
        setPulseAnnouncement('')
      } else if (sessionStateChanged && !session.is_active) {
        setPulseAnnouncement(
          'La clase se cerró y dejó de recibir respuestas.',
        )
      } else if (pulseChanged && nextPulseId) {
        const pulseLabel = session.active_pulse_ordinal
          ? ` ${session.active_pulse_ordinal}`
          : ''
        setPulseAnnouncement(
          wasAlreadySubmitted
            ? `El pulso${pulseLabel} está disponible y tu respuesta ya está registrada.`
            : `Nuevo pulso${pulseLabel} disponible. Ya puedes responder.`,
        )
      } else if (pulseChanged) {
        setPulseAnnouncement(
          'El pulso anterior terminó. Espera a que el profesor abra el siguiente.',
        )
      } else if (sessionStateChanged) {
        setPulseAnnouncement(
          !nextPulseId
            ? 'La clase volvió a abrirse. Espera a que el profesor abra el siguiente pulso.'
            : wasAlreadySubmitted
              ? 'La clase volvió a abrirse. Tu respuesta para este pulso ya está registrada.'
              : 'La clase volvió a abrirse. Ya puedes responder el pulso actual.',
        )
      }
    }

    observedSessionIdRef.current = session.id
    observedPulseIdRef.current = nextPulseId
    observedSessionActiveRef.current = session.is_active
  }, [
    session?.active_pulse_id,
    session?.active_pulse_ordinal,
    session?.id,
    session?.is_active,
  ])

  useEffect(() => {
    let isMounted = true
    const pulseId = session?.active_pulse_id

    if (!session?.is_active || !pulseId) {
      setIsSecurityLoading(false)
      setTurnstileStatus('loading')
      return () => {
        isMounted = false
      }
    }

    setTurnstileStatus('loading')
    if (submissionSecurity) {
      setIsSecurityLoading(false)
      return () => {
        isMounted = false
      }
    }

    setIsSecurityLoading(true)
    setSecurityError(null)

    const loadSecurity = async () => {
      try {
        const security = await getResponseSubmissionSecurity()
        if (isMounted) setSubmissionSecurity(security)
      } catch (error) {
        if (isMounted) {
          setTurnstileStatus('error')
          setSecurityError(
            getErrorMessage(
              error,
              'El envío seguro no está disponible temporalmente.',
            ),
          )
        }
      } finally {
        if (isMounted) setIsSecurityLoading(false)
      }
    }

    void loadSecurity()

    return () => {
      isMounted = false
    }
  }, [
    session?.active_pulse_id,
    session?.is_active,
    submissionSecurity,
  ])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const result = responseSchema.safeParse({
      status: status ?? undefined,
      questionText,
    })

    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setErrors({
        status: fields.status?.[0],
        questionText: fields.questionText?.[0],
      })
      return
    }

    if (!session?.is_active) {
      setSubmitError('La clase ya no está recibiendo respuestas.')
      void refreshSessionRef.current()
      return
    }

    const pulseId = session.active_pulse_id
    if (!pulseId) {
      setSubmitError(
        'Este pulso ya terminó. Espera a que el profesor abra el siguiente.',
      )
      void refreshSessionRef.current()
      return
    }

    if (
      !submissionSecurity
      || !turnstileRef.current
      || turnstileStatus !== 'ready'
    ) {
      setSubmitError(
        'La verificación segura aún no está lista. Espera un momento e intenta nuevamente.',
      )
      return
    }
    setErrors({})
    setIsSubmitting(true)

    try {
      const turnstileToken = await turnstileRef.current.execute()
      await submitStudentResponse({
        sessionId: session.id,
        pulseId,
        anonymousId,
        status: result.data.status,
        questionText: result.data.questionText,
      }, turnstileToken)
      rememberSubmittedPulse(pulseId)

      if (activePulseIdRef.current === pulseId) {
        setSubmittedStatus(result.data.status)
        setIsSubmitted(true)
        setPulseAnnouncement('')
        void questionWall.refresh()
      }
    } catch (error) {
      const errorCode = getErrorCode(error)

      if (errorCode === 'duplicate_response') {
        rememberSubmittedPulse(pulseId)
      }

      if (activePulseIdRef.current !== pulseId) return

      if (errorCode === 'duplicate_response') {
        setSubmittedStatus(null)
        setIsSubmitted(true)
        setPulseAnnouncement(
          'Tu respuesta para este pulso ya estaba registrada.',
        )
        void questionWall.refresh()
      } else if (errorCode === 'session_inactive') {
        setSubmitError('La clase ya no está recibiendo respuestas.')
        setSession((current) => (current ? { ...current, is_active: false } : current))
        void refreshSessionRef.current()
      } else if (
        errorCode === 'pulse_inactive'
        || errorCode === 'pulse_not_active'
        || errorCode === 'pulse_closed'
        || errorCode === 'no_active_pulse'
      ) {
        setSubmitError(
          'Este pulso ya terminó. Espera a que el profesor abra el siguiente.',
        )
        void refreshSessionRef.current()
      } else if (errorCode === 'response_rate_limit') {
        setSubmitError('Se recibieron demasiados envíos desde esta red. Espera unos minutos.')
      } else if (
        errorCode === 'pulse_response_limit'
        || errorCode === 'session_response_limit'
      ) {
        setSubmitError('Este pulso alcanzó su capacidad máxima de respuestas.')
      } else if (errorCode === 'verification_failed') {
        setSubmitError('No pudimos verificar el envío. Intenta nuevamente.')
      } else if (
        errorCode === 'verification_unavailable'
        || errorCode === 'submission_not_configured'
      ) {
        setSubmitError('El envío seguro no está disponible temporalmente. Intenta en unos minutos.')
      } else {
        setSubmitError(
          getErrorMessage(error, 'No pudimos enviar tu respuesta. Intenta otra vez.'),
        )
      }
    } finally {
      if (activePulseIdRef.current === pulseId) {
        turnstileRef.current?.reset()
        setIsSubmitting(false)
      }
    }
  }

  if (isLoading) {
    return (
      <main className="signal-shell min-h-screen bg-[#f4f7fb]">
        <StudentHeader />
        <div className="mx-auto max-w-xl px-5 py-10" aria-label="Cargando clase" role="status">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 h-10 w-4/5 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-6 w-3/5 animate-pulse rounded bg-slate-100" />
          <div className="mt-8 h-96 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="signal-shell min-h-screen bg-[#f4f7fb]">
        <StudentHeader />
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-200 text-slate-600">
            <MessageSquareText className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-extrabold tracking-[0.15em] text-blue-700 uppercase">Código {code.toUpperCase()}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">No encontramos esta clase</h1>
          <p className="mt-4 leading-7 text-slate-600">
            {loadError || 'Revisa el enlace con tu profesor. Puede que el código esté incompleto o haya cambiado.'}
          </p>
        </div>
      </main>
    )
  }

  const activePulseId = session.active_pulse_id

  return (
    <main className="signal-shell min-h-screen bg-[#f4f7fb] pb-10">
      <StudentHeader />

      <div className="mx-auto max-w-xl px-5 py-8 sm:py-10">
        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_34px_rgba(7,26,43,0.055)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
            {session.subject}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {session.is_active && activePulseId && session.active_pulse_ordinal && (
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">
                Pulso {session.active_pulse_ordinal}
              </span>
            )}
            <span className="rounded-lg bg-slate-200 px-2.5 py-1 font-mono text-xs font-extrabold tracking-[0.12em] text-slate-700">
              {session.code}
            </span>
          </div>
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {session.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{session.topic}</p>
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
          <p>
            <strong>Tu respuesta es anónima.</strong> Este envío usa un canal público separado y no incluye tu nombre, correo, cuenta ni matrícula.
            {' '}Tu profesor puede compartir el texto de tu duda de forma anónima con el grupo.
          </p>
        </div>

        {refreshError && (
          <Alert className="mt-5" tone="error">
            {refreshError}
          </Alert>
        )}

        <div aria-live="polite">
          {pulseAnnouncement && (
            <Alert className="mt-5" title="Actualización de la clase">
              {pulseAnnouncement}
            </Alert>
          )}
        </div>

        {!session.is_active ? (
          <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_38px_rgba(7,26,43,0.06)] sm:p-9">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-600">
              <Clock3 className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">La clase está cerrada</h2>
            <p className="mt-3 leading-7 text-slate-600">
              El profesor ya finalizó la recepción de respuestas. Consulta con él si la clase volverá a abrirse.
            </p>
          </section>
        ) : !activePulseId ? (
          <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_38px_rgba(7,26,43,0.06)] sm:p-9" aria-live="polite">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <Clock3 className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-6 text-xs font-extrabold tracking-[0.14em] text-amber-700 uppercase">
              Entre pulsos
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Esperando el próximo pulso
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              La clase sigue abierta. El profesor está preparando la siguiente comprobación y aparecerá aquí automáticamente.
            </p>
          </section>
        ) : isSubmitted ? (
          <section className="mt-7 rounded-[1.5rem] border border-emerald-200 bg-white p-6 text-center shadow-[0_12px_38px_rgba(7,26,43,0.06)] sm:p-9" aria-live="polite">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </span>
            <p className="mt-6 text-xs font-extrabold tracking-[0.14em] text-emerald-700 uppercase">
              {session.active_pulse_ordinal
                ? `Pulso ${session.active_pulse_ordinal} registrado`
                : 'Respuesta registrada'}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Gracias por decir cómo vas</h2>
            <p className="mt-3 leading-7 text-slate-600">
              {submittedStatus ? (
                <>
                  Tu profesor ya puede ver la señal <strong>{statusContent[submittedStatus].label.toLowerCase()}</strong>, sin saber quién la envió.
                </>
              ) : (
                <>Tu respuesta para este pulso ya está registrada, sin revelar quién la envió.</>
              )}
            </p>
            <p className="mt-5 text-sm font-semibold text-slate-500">
              Tu señal quedó registrada. Revisa abajo las dudas anónimas de tu clase.
            </p>
          </section>
        ) : (
          <form className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(7,26,43,0.07)] sm:p-7" noValidate onSubmit={handleSubmit}>
            <p className="mb-5 text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
              {session.active_pulse_ordinal
                ? `Pulso ${session.active_pulse_ordinal} · abierto`
                : 'Pulso abierto'}
            </p>
            <StatusSelector
              disabled={isSubmitting}
              error={errors.status}
              onChange={setStatus}
              value={status}
            />

            <div className="mt-7 border-t border-slate-100 pt-7">
              <div className="flex items-baseline justify-between gap-3">
                <label className="text-base font-extrabold text-slate-950" htmlFor="questionText">
                  ¿Qué te genera duda? <span className="font-medium text-slate-400">(opcional)</span>
                </label>
                <span className="text-xs font-semibold text-slate-400">{questionText.length}/1000</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                No necesitas formularla perfectamente. Escribe lo que te está costando. Si el profesor
                activa el muro, podrá compartirla de forma anónima con el grupo.
              </p>
              <textarea
                aria-describedby={errors.questionText ? 'questionText-error' : undefined}
                aria-invalid={Boolean(errors.questionText)}
                className="form-input mt-3 min-h-32 resize-y py-3"
                disabled={isSubmitting}
                id="questionText"
                maxLength={1000}
                onChange={(event) => setQuestionText(event.target.value)}
                placeholder="Ej. No entiendo por qué el límite por la izquierda da un valor distinto…"
                value={questionText}
              />
              {errors.questionText && <p className="mt-2 text-sm font-medium text-red-700" id="questionText-error">{errors.questionText}</p>}
            </div>

            {submitError && <Alert className="mt-6" tone="error">{submitError}</Alert>}

            {submissionSecurity && (
              <InvisibleTurnstile
                action={submissionSecurity.turnstile.action}
                cData={activePulseId}
                key={activePulseId}
                onStatusChange={setTurnstileStatus}
                ref={turnstileRef}
                siteKey={submissionSecurity.turnstile.siteKey}
              />
            )}

            {(securityError || turnstileStatus === 'error') && (
              <Alert className="mt-6" tone="error" title="Envío seguro no disponible">
                {securityError || 'No pudimos cargar la verificación antiabuso. Revisa tu conexión y recarga la página.'}
              </Alert>
            )}

            <p className="sr-only" role="status" aria-live="polite">
              {isSecurityLoading || turnstileStatus === 'loading'
                ? 'Preparando verificación segura.'
                : turnstileStatus === 'running'
                  ? 'Verificando el envío.'
                  : turnstileStatus === 'ready'
                    ? 'Verificación segura lista.'
                    : 'La verificación segura no está disponible.'}
            </p>

            <div className="sticky bottom-3 z-20 mt-7 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_14px_35px_rgba(7,26,43,0.16)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <Button
                disabled={
                  isSecurityLoading
                  || !submissionSecurity
                  || turnstileStatus === 'loading'
                  || turnstileStatus === 'error'
                }
                fullWidth
                isLoading={isSubmitting}
                type="submit"
              >
                {isSecurityLoading || turnstileStatus === 'loading'
                  ? 'Preparando envío seguro…'
                  : isSubmitting
                    ? 'Verificando y enviando…'
                    : 'Enviar de forma anónima'}
                {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
              <p className="mt-2 text-center text-xs leading-5 text-slate-400 sm:mt-3">
                Una respuesta por pulso y dispositivo. Turnstile procesa señales técnicas para evitar abuso;
                ClassSignal no guarda tu IP en la base de datos.{' '}
                <Link
                  className="font-bold text-slate-500 underline underline-offset-2 hover:text-slate-700"
                  to="/privacidad"
                >
                  Privacidad
                </Link>
              </p>
            </div>
          </form>
        )}

        {session.is_active && activePulseId && (
          <PublicQuestionWall
            error={questionWall.error}
            hasLoaded={questionWall.hasLoaded}
            isInitialLoading={questionWall.isInitialLoading}
            isRefreshing={questionWall.isRefreshing}
            isVisible={questionWall.isVisible}
            onRefresh={questionWall.refresh}
            questions={questionWall.questions}
          />
        )}
      </div>
    </main>
  )
}

function StudentHeader() {
  return (
    <header className="border-b border-white/10 bg-[#071a2b] text-white shadow-[0_8px_25px_rgba(7,26,43,0.12)]">
      <div className="mx-auto flex min-h-[4.75rem] max-w-xl items-center justify-between gap-3 px-5 py-3">
        <div className="sm:hidden">
          <Brand compact inverse to="/unirse" />
        </div>
        <div className="hidden sm:block">
          <Brand inverse to="/unirse" />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold tracking-wide text-[#87eadc]">
          <span className="size-1.5 rounded-full bg-[#66e2d1]" aria-hidden="true" />
          Modo estudiante
        </span>
      </div>
    </header>
  )
}
