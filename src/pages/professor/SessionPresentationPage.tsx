import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Clock3,
  LockKeyhole,
  RadioTower,
  SearchX,
  UsersRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useParams } from 'react-router-dom'

import { PulseStatusBadge } from '../../components/pulses/PulseStatusBadge'
import { useSessionPulses } from '../../hooks/useSessionPulses'
import { useSessionResponses } from '../../hooks/useSessionResponses'
import { cn } from '../../lib/cn'
import { getPublicAppOrigin } from '../../lib/env'
import { getErrorMessage } from '../../lib/errors'
import { buildStatusSummary, formatTime, statusContent } from '../../lib/format'
import { getSessionById } from '../../services/sessions.service'
import type {
  ClassSession,
  UnderstandingStatus,
} from '../../types/domain'

const statusPresentation: Record<
  UnderstandingStatus,
  {
    icon: typeof CheckCircle2
    accent: string
    bar: string
    glow: string
  }
> = {
  understood: {
    icon: CheckCircle2,
    accent: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
    bar: 'bg-emerald-400',
    glow: 'shadow-[0_0_32px_rgba(52,211,153,0.12)]',
  },
  question: {
    icon: CircleHelp,
    accent: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    bar: 'bg-amber-300',
    glow: 'shadow-[0_0_32px_rgba(252,211,77,0.1)]',
  },
  lost: {
    icon: SearchX,
    accent: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    bar: 'bg-rose-400',
    glow: 'shadow-[0_0_32px_rgba(251,113,133,0.1)]',
  },
}

export function SessionPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<ClassSession | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const {
    responses,
    isLoading: isLoadingResponses,
    error: responsesError,
    realtimeStatus,
  } = useSessionResponses(session?.id)

  const {
    pulses,
    activePulse,
    isLoading: isLoadingPulses,
    error: pulsesError,
    realtimeStatus: pulsesRealtimeStatus,
  } = useSessionPulses(session?.id)

  useEffect(() => {
    let isMounted = true

    if (!id) {
      setSessionError('La clase solicitada no es válida.')
      setIsLoadingSession(false)
      return undefined
    }

    const loadSession = async (isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setIsLoadingSession(true)
        setSessionError(null)
      }

      try {
        const result = await getSessionById(id)
        if (!isMounted) return

        setSession(result)
        if (!result) {
          setSessionError('No encontramos esta clase o no pertenece a tu cuenta.')
        }
      } catch (error) {
        if (!isMounted) return
        if (isInitialLoad) {
          setSessionError(
            getErrorMessage(error, 'No pudimos cargar esta clase.'),
          )
        }
      } finally {
        if (isMounted && isInitialLoad) setIsLoadingSession(false)
      }
    }

    void loadSession(true)
    const pollingTimer = window.setInterval(() => {
      void loadSession(false)
    }, 15_000)

    return () => {
      isMounted = false
      window.clearInterval(pollingTimer)
    }
  }, [id])

  if (isLoadingSession) {
    return <PresentationLoading />
  }

  if (!session) {
    return <PresentationError message={sessionError} />
  }

  const publicUrl = `${getPublicAppOrigin()}/s/${session.code}`
  const displayPulse = activePulse ?? pulses[pulses.length - 1] ?? null
  const displayResponses = displayPulse
    ? responses.filter((response) => response.pulse_id === displayPulse.id)
    : []
  const summary = buildStatusSummary(displayResponses)
  const isRealtimeConnected = realtimeStatus === 'SUBSCRIBED'
    && pulsesRealtimeStatus === 'SUBSCRIBED'
  const hasRealtimeError = [realtimeStatus, pulsesRealtimeStatus].some(
    (status) => ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status),
  )
  const latestResponseAt = displayResponses[0]?.created_at
  const isShowingLastPulse = Boolean(displayPulse && !activePulse)

  return (
    <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#061623] text-white">
      <div className="relative min-h-dvh overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(49,92,246,0.24),transparent_30%),radial-gradient(circle_at_88%_80%,rgba(22,184,166,0.18),transparent_32%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-dvh w-full max-w-[112rem] flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-4 2xl:px-12 2xl:py-5">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 lg:pb-3">
            <div className="flex min-w-0 items-center gap-3" aria-label="ClassSignal">
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:size-12">
                <img
                  alt=""
                  className="size-full object-cover"
                  height="48"
                  src="/brand/classsignal-mark.png"
                  width="48"
                />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black tracking-[-0.035em] sm:text-xl">
                  Class<span className="text-[#66e2d1]">Signal</span>
                </p>
                <p className="hidden text-xs font-bold tracking-[0.13em] text-slate-400 uppercase sm:block">
                  Modo proyector
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Link
                aria-label="Volver al panel de la clase"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                title="Volver al panel de la clase"
                to={`/profesor/sesion/${session.id}`}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
              <span
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-extrabold sm:text-sm',
                  session.is_active
                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                    : 'border-white/10 bg-white/[0.06] text-slate-300',
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    session.is_active ? 'bg-emerald-400' : 'bg-slate-500',
                  )}
                  aria-hidden="true"
                />
                {session.is_active ? 'Clase activa' : 'Clase finalizada'}
              </span>
              {displayPulse && (
                <PulseStatusBadge
                  inverse
                  isActive={Boolean(activePulse)}
                  ordinal={displayPulse.ordinal}
                />
              )}
              <span
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-extrabold sm:text-sm',
                  isRealtimeConnected
                    ? 'border-blue-300/20 bg-blue-300/10 text-blue-100'
                    : hasRealtimeError
                      ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
                      : 'border-amber-300/20 bg-amber-300/10 text-amber-100',
                )}
                role="status"
              >
                {isRealtimeConnected ? (
                  <Wifi className="size-4" aria-hidden="true" />
                ) : hasRealtimeError ? (
                  <WifiOff className="size-4" aria-hidden="true" />
                ) : (
                  <RadioTower className="size-4 animate-pulse" aria-hidden="true" />
                )}
                {isRealtimeConnected
                  ? 'En vivo'
                  : hasRealtimeError
                    ? 'Sin conexión'
                    : 'Conectando'}
              </span>
            </div>
          </header>

          <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)] lg:gap-6 lg:py-4 2xl:gap-8">
            <section className="flex flex-col justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:p-7 lg:p-6" aria-labelledby="join-title">
              <div className="mx-auto w-full max-w-[26rem] text-center">
                <p className="text-xs font-extrabold tracking-[0.16em] text-[#87eadc] uppercase sm:text-sm">
                  {activePulse ? 'Únete a la señal' : 'Acceso de la clase'}
                </p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl" id="join-title">
                  {activePulse ? 'Escanea para responder' : 'Conserva este acceso'}
                </p>

                <figure className="mx-auto mt-4 w-full max-w-[min(20rem,34vh)] rounded-[1.5rem] bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-5">
                  <QRCodeSVG
                    bgColor="#ffffff"
                    className="h-auto w-full"
                    fgColor="#071a2b"
                    level="Q"
                    marginSize={1}
                    size={420}
                    title={`Código QR para la clase ${session.code}`}
                    value={publicUrl}
                  />
                  <figcaption className="sr-only">
                    Código QR para acceder de forma anónima a la clase {session.title}.
                  </figcaption>
                </figure>

                <p className="mt-4 text-xs font-extrabold tracking-[0.15em] text-slate-400 uppercase sm:text-sm">
                  Código de acceso
                </p>
                <p className="mt-1 font-mono text-5xl leading-none font-black tracking-[0.13em] text-white sm:text-7xl lg:text-[clamp(3.5rem,5vw,5.5rem)]">
                  {session.code}
                </p>
                <p className="mt-4 break-all text-xs font-semibold text-slate-400 sm:text-sm lg:hidden">
                  {publicUrl}
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-300 sm:text-sm">
                  <LockKeyhole className="size-4 text-[#66e2d1]" aria-hidden="true" />
                  Sin cuenta, nombre ni correo
                </p>
              </div>
            </section>

            <section className="flex min-w-0 flex-col justify-center" aria-labelledby="session-title">
              <div>
                <p className="text-xs font-extrabold tracking-[0.16em] text-blue-200 uppercase sm:text-sm">
                  {session.subject}
                </p>
                <h1 className="mt-2 max-w-5xl text-3xl leading-[1.05] font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-[clamp(2.7rem,3.5vw,4.4rem)]" id="session-title">
                  {session.title}
                </h1>
                <p className="mt-3 max-w-5xl text-base leading-7 font-medium text-slate-300 sm:mt-5 sm:text-xl sm:leading-8 lg:text-xl lg:leading-8">
                  {session.topic}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-5 sm:mt-8 sm:pt-6">
                <div>
                  <p className="text-xs font-extrabold tracking-[0.15em] text-[#87eadc] uppercase sm:text-sm">
                    {displayPulse ? `Pulso ${displayPulse.ordinal}` : 'Pulso colectivo'}
                  </p>
                  <p className="mt-1 text-xl font-black tracking-tight sm:text-2xl lg:text-3xl">
                    {activePulse
                      ? 'Comprensión en tiempo real'
                      : displayPulse
                        ? session.is_active ? 'Último pulso disponible' : 'Pulso final de la clase'
                        : 'Esperando el primer pulso'}
                  </p>
                </div>

                <div className="text-right" aria-live="polite" aria-atomic="true">
                  <p className="flex items-center justify-end gap-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                    <UsersRound className="size-6 text-blue-200 sm:size-7" aria-hidden="true" />
                    {displayResponses.length}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400 sm:text-sm">
                    {displayResponses.length === 1 ? 'señal recibida' : 'señales recibidas'}
                  </p>
                </div>
              </div>

              {responsesError && (
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100" role="alert">
                  No pudimos actualizar ahora. Mostramos el último pulso disponible. {responsesError}
                </div>
              )}
              {pulsesError && (
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100" role="alert">
                  No pudimos comprobar si el docente abrió otro pulso. {pulsesError}
                </div>
              )}

              {isShowingLastPulse && displayPulse && (
                <div className="mt-5 rounded-2xl border border-blue-300/20 bg-blue-300/10 p-4 text-sm font-semibold text-blue-100" role="status">
                  {session.is_active
                    ? `El pulso ${displayPulse.ordinal} está cerrado. Esperando que el docente abra el siguiente.`
                    : `La clase finalizó. Mostramos los resultados del pulso ${displayPulse.ordinal}.`}
                </div>
              )}

              {!displayPulse && !isLoadingPulses && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-center">
                  <RadioTower className="mx-auto size-7 text-[#66e2d1]" aria-hidden="true" />
                  <p className="mt-3 text-lg font-extrabold text-white">Aún no hay un pulso abierto</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Conserva el código en pantalla. Las señales aparecerán cuando el docente inicie el primer pulso.
                  </p>
                </div>
              )}

              {activePulse && displayResponses.length === 0 && !isLoadingResponses && (
                <div className="mt-5 rounded-2xl border border-teal-300/20 bg-teal-300/10 p-6 text-center" role="status">
                  <RadioTower className="mx-auto size-7 animate-pulse text-[#66e2d1]" aria-hidden="true" />
                  <p className="mt-3 text-lg font-extrabold text-white">
                    Pulso {activePulse.ordinal} abierto
                  </p>
                  <p className="mt-2 text-sm leading-6 text-teal-100">
                    Esperando las primeras señales del grupo.
                  </p>
                </div>
              )}

              {displayPulse && displayResponses.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:gap-4" aria-label="Resumen agregado de comprensión">
                  {summary.map((item) => {
                    const presentation = statusPresentation[item.status]
                    const Icon = presentation.icon

                    return (
                      <article
                        className={cn(
                          'rounded-2xl border p-4 sm:p-5 lg:p-5',
                          presentation.accent,
                          presentation.glow,
                        )}
                        key={item.status}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Icon className="size-6 shrink-0 sm:size-7" aria-hidden="true" />
                          <span className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-4xl">
                            {item.percentage}%
                          </span>
                        </div>
                        <h3 className="mt-4 text-sm font-extrabold text-white sm:text-base">
                          {statusContent[item.status].label}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-current/80 sm:text-sm">
                          {item.count} {item.count === 1 ? 'señal' : 'señales'}
                        </p>
                        <div
                          aria-label={`${statusContent[item.status].label}: ${item.percentage}%`}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={item.percentage}
                          className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
                          role="progressbar"
                        >
                          <div
                            className={cn('h-full rounded-full transition-[width] duration-500', presentation.bar)}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400 sm:mt-5 sm:text-sm">
                <p>Solo mostramos datos agregados; ninguna respuesta individual aparece en pantalla.</p>
                {latestResponseAt && (
                  <p className="inline-flex items-center gap-2">
                    <Clock3 className="size-4" aria-hidden="true" />
                    Última señal: {formatTime(latestResponseAt)}
                  </p>
                )}
                {(isLoadingPulses || isLoadingResponses) && displayResponses.length === 0 && (
                  <p className="inline-flex items-center gap-2" role="status">
                    <RadioTower className="size-4 animate-pulse" aria-hidden="true" />
                    Preparando el pulso de la clase…
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function PresentationLoading() {
  return (
    <main className="fixed inset-0 z-[100] grid min-h-dvh place-items-center bg-[#061623] px-5 text-white" aria-label="Cargando modo proyector" role="status">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10 text-[#66e2d1]">
          <RadioTower className="size-7 animate-pulse" aria-hidden="true" />
        </span>
        <p className="mt-5 text-lg font-extrabold">Preparando la señal de la clase…</p>
      </div>
    </main>
  )
}

function PresentationError({ message }: { message: string | null }) {
  return (
    <main className="fixed inset-0 z-[100] grid min-h-dvh place-items-center bg-[#061623] px-5 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-10" aria-labelledby="presentation-error-title">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-300/10 text-rose-200">
          <WifiOff className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-tight" id="presentation-error-title">
          No pudimos abrir el modo proyector
        </h1>
        <p className="mt-3 leading-7 text-slate-300">
          {message || 'Verifica que la clase exista y vuelva a intentarlo.'}
        </p>
      </section>
    </main>
  )
}
