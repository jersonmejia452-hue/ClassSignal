import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ConfusionMapPanel } from '../components/analysis/ConfusionMapPanel'
import { CoursePulseHistory } from '../components/courses/CoursePulseHistory'
import { DemoProgress, demoSteps } from '../components/demo/DemoProgress'
import { ResponseFeed } from '../components/responses/ResponseFeed'
import { ResponseSummary } from '../components/responses/ResponseSummary'
import { StatusSelector } from '../components/responses/StatusSelector'
import { Alert } from '../components/ui/Alert'
import { Brand } from '../components/ui/Brand'
import { Button } from '../components/ui/Button'
import {
  createDemoResponses,
  createDemoSecondPulseResponses,
  DEMO_ANALYSIS,
  DEMO_COURSE,
  DEMO_DEFAULT_SIGNAL,
  DEMO_PULSE_ONE,
  DEMO_PULSE_TWO,
  DEMO_PULSE_HISTORY,
  DEMO_SECOND_PULSE_DEFAULT_SIGNAL,
  DEMO_SESSION,
} from '../demo/classsignal-demo.data'
import { buildStatusSummary, statusContent } from '../lib/format'
import type {
  CoursePulsePoint,
  StudentResponse,
  UnderstandingStatus,
} from '../types/domain'

function buildInteractiveHistory(
  responses: StudentResponse[],
): CoursePulsePoint[] {
  const summary = buildStatusSummary(responses)
  const counts = Object.fromEntries(
    summary.map((item) => [item.status, item.count]),
  ) as Record<UnderstandingStatus, number>

  return DEMO_PULSE_HISTORY.map((point, index) => (
    index === 0
      ? {
          ...point,
          response_count: responses.length,
          understood_count: counts.understood,
          question_count: counts.question,
          lost_count: counts.lost,
        }
      : { ...point }
  ))
}

const demoStatusColors: Record<UnderstandingStatus, string> = {
  understood: 'bg-emerald-500',
  question: 'bg-amber-500',
  lost: 'bg-red-500',
}

function DemoPulseDistribution({
  label,
  responses,
}: {
  label: string
  responses: StudentResponse[]
}) {
  const summary = buildStatusSummary(responses)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-[#071a2b]">{label}</h3>
        <span className="text-xs font-bold text-slate-500">
          {responses.length} respuestas
        </span>
      </div>
      <div
        aria-label={`${label}: ${summary.map((item) => `${item.percentage}% ${statusContent[item.status].shortLabel.toLowerCase()}`).join(', ')}`}
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100"
        role="img"
      >
        {summary.map((item) => (
          <span
            className={demoStatusColors[item.status]}
            key={item.status}
            style={{ width: `${item.percentage}%` }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {summary.map((item) => (
          <div key={item.status}>
            <dt className="text-[0.68rem] leading-4 font-bold text-slate-500">
              {statusContent[item.status].shortLabel}
            </dt>
            <dd className="mt-1 text-lg font-black text-slate-900">
              {item.percentage}%
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function DemoPulseComparison({
  firstResponses,
  secondResponses,
}: {
  firstResponses: StudentResponse[]
  secondResponses: StudentResponse[]
}) {
  const firstSummary = buildStatusSummary(firstResponses)
  const secondSummary = buildStatusSummary(secondResponses)

  return (
    <section aria-labelledby="demo-comparison-title">
      <div>
        <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
          Antes y después
        </p>
        <h2
          className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]"
          id="demo-comparison-title"
        >
          La intervención produjo una nueva medición
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Ambos pulsos usan el mismo código y muestran resultados agregados; no
          se sigue a estudiantes individuales entre rondas.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DemoPulseDistribution
          label={`Pulso ${DEMO_PULSE_ONE.ordinal} · Antes`}
          responses={firstResponses}
        />
        <DemoPulseDistribution
          label={`Pulso ${DEMO_PULSE_TWO.ordinal} · Después`}
          responses={secondResponses}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {secondSummary.map((item, index) => {
          const previous = firstSummary[index]!
          const delta = item.percentage - previous.percentage
          const isImprovement = item.status === 'understood'
            ? delta >= 0
            : delta <= 0

          return (
            <article
              className={`rounded-2xl border p-4 ${isImprovement ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
              key={item.status}
            >
              <p className="text-xs font-extrabold text-slate-600">
                {statusContent[item.status].shortLabel}
              </p>
              <p className={`mt-2 text-2xl font-black ${isImprovement ? 'text-emerald-800' : 'text-red-800'}`}>
                {delta > 0 ? '+' : ''}{delta} pp
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {previous.percentage}% → {item.percentage}%
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

async function keepDemoStatic() {
  // The shared analysis component requires an async callback. In demo mode the
  // completed result is immutable and its action remains disabled.
}

function scrollDemoToTop() {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
}

export function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [status, setStatus] = useState<UnderstandingStatus | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [statusError, setStatusError] = useState<string | undefined>()
  const [secondStatus, setSecondStatus] = useState<UnderstandingStatus | null>(null)
  const [secondQuestionText, setSecondQuestionText] = useState('')
  const [secondStatusError, setSecondStatusError] = useState<string | undefined>()
  const [hasSubmittedSecondPulse, setHasSubmittedSecondPulse] = useState(false)
  const stepRegionRef = useRef<HTMLDivElement>(null)
  const shouldFocusStep = useRef(false)

  const firstPulseResponses = useMemo(
    () => createDemoResponses({
      status: status ?? DEMO_DEFAULT_SIGNAL.status,
      questionText,
    }),
    [questionText, status],
  )
  const secondPulseResponses = useMemo(
    () => createDemoSecondPulseResponses({
      status: secondStatus ?? DEMO_SECOND_PULSE_DEFAULT_SIGNAL.status,
      questionText: secondQuestionText,
    }),
    [secondQuestionText, secondStatus],
  )
  const history = useMemo(
    () => buildInteractiveHistory(secondPulseResponses),
    [secondPulseResponses],
  )

  useEffect(() => {
    if (!shouldFocusStep.current) return

    stepRegionRef.current?.focus({ preventScroll: true })
    shouldFocusStep.current = false
  }, [currentStep])

  const changeStep = (nextStep: number) => {
    shouldFocusStep.current = true
    setCurrentStep(Math.max(0, Math.min(nextStep, demoSteps.length - 1)))
    scrollDemoToTop()
  }

  const submitSignal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!status) {
      setStatusError('Selecciona una señal para continuar la demostración.')
      return
    }

    setStatusError(undefined)
    setSecondStatus(null)
    setSecondQuestionText('')
    setSecondStatusError(undefined)
    setHasSubmittedSecondPulse(false)
    changeStep(1)
  }

  const submitSecondSignal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!secondStatus) {
      setSecondStatusError('Selecciona una señal para completar el segundo pulso.')
      return
    }

    setSecondStatusError(undefined)
    setHasSubmittedSecondPulse(true)
    scrollDemoToTop()
    window.requestAnimationFrame(() => {
      stepRegionRef.current?.focus({ preventScroll: true })
    })
  }

  const goToStep = (nextStep: number) => {
    changeStep(nextStep)
  }

  const resetDemo = () => {
    setStatus(null)
    setQuestionText('')
    setStatusError(undefined)
    setSecondStatus(null)
    setSecondQuestionText('')
    setSecondStatusError(undefined)
    setHasSubmittedSecondPulse(false)
    changeStep(0)
  }

  return (
    <main className="signal-shell min-h-screen bg-[#f4f7fb]">
      <header className="border-b border-white/10 bg-[#071a2b] text-white shadow-[0_8px_25px_rgba(7,26,43,0.12)]">
        <div className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="sm:hidden">
            <Brand compact inverse to="/demo" />
          </div>
          <div className="hidden sm:block">
            <Brand inverse to="/demo" />
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
            to="/profesor/login"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Salir de la demo
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <section className="relative overflow-hidden rounded-[1.75rem] bg-[#071a2b] p-6 text-white shadow-[0_24px_70px_rgba(7,26,43,0.22)] sm:p-8 lg:p-10">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_top_right,rgba(49,92,246,0.46),transparent_62%)]" aria-hidden="true" />
          <div className="absolute right-10 bottom-0 hidden h-36 items-end gap-2 opacity-35 sm:flex" aria-hidden="true">
            {[52, 84, 68, 108, 78, 126, 96].map((height) => (
              <span
                className="w-2 rounded-t-full bg-[#66e2d1]"
                key={height}
                style={{ height }}
              />
            ))}
          </div>

          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-extrabold tracking-[0.13em] text-[#87eadc] uppercase">
              <Sparkles className="size-4" aria-hidden="true" />
              Demo interactiva · 2 minutos
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl leading-tight font-black tracking-[-0.045em] sm:text-5xl">
              Detecta, interviene y vuelve a medir sin cambiar el enlace.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Recorre una clase simulada de {DEMO_COURSE.name}. No necesitas
              cuenta, no se escribe nada en Supabase y no se ejecuta ningún
              análisis de OpenAI.
            </p>

            <dl className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <dt className="text-xs font-bold text-slate-400">Salón simulado</dt>
                <dd className="mt-1 flex items-center gap-2 text-lg font-black">
                  <UsersRound className="size-5 text-[#66e2d1]" aria-hidden="true" />
                  20 estudiantes
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <dt className="text-xs font-bold text-slate-400">Privacidad</dt>
                <dd className="mt-1 flex items-center gap-2 text-lg font-black">
                  <ShieldCheck className="size-5 text-[#66e2d1]" aria-hidden="true" />
                  Sin cuentas
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <dt className="text-xs font-bold text-slate-400">Costo de esta demo</dt>
                <dd className="mt-1 flex items-center gap-2 text-lg font-black">
                  <BrainCircuit className="size-5 text-[#66e2d1]" aria-hidden="true" />
                  $0 en API
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <DemoProgress className="mt-5" currentStep={currentStep} />

        <div
          aria-label={`Paso ${currentStep + 1}: ${demoSteps[currentStep]!.label}`}
          aria-live="polite"
          className="mt-5 rounded-[1.6rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          ref={stepRegionRef}
          role="region"
          tabIndex={-1}
        >
          {currentStep === 0 && (
            <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(7,26,43,0.07)] sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
              <form noValidate onSubmit={submitSignal}>
                <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
                  Paso 1 · Pulso {DEMO_PULSE_ONE.ordinal} · Vista estudiante
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#071a2b] sm:text-3xl">
                  Envía una señal anónima
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Tema: <strong>{DEMO_SESSION.topic}</strong>
                </p>

                <div className="mt-7">
                  <StatusSelector
                    error={statusError}
                    onChange={(nextStatus) => {
                      setStatus(nextStatus)
                      setStatusError(undefined)
                    }}
                    value={status}
                  />
                </div>

                <label
                  className="mt-6 block text-sm font-extrabold text-slate-900"
                  htmlFor="demo-question"
                >
                  ¿Qué te genera duda? <span className="font-semibold text-slate-400">(opcional)</span>
                </label>
                <textarea
                  className="form-input mt-2 min-h-28 resize-y py-3"
                  id="demo-question"
                  maxLength={1000}
                  onChange={(event) => setQuestionText(event.target.value)}
                  placeholder="Ej. No entiendo cómo las componentes determinan la dirección…"
                  value={questionText}
                />
                <p className="mt-1 text-right text-xs font-semibold text-slate-400">
                  {questionText.length}/1000
                </p>

                <Button className="mt-6" type="submit">
                  Simular envío y ver el panel
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </form>

              <aside className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 lg:mt-0">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-700 text-white">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-extrabold text-[#071a2b]">
                  Estás en un entorno seguro de muestra
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-teal-600" aria-hidden="true" />
                    Tu selección solo vive en esta pestaña.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-teal-600" aria-hidden="true" />
                    No se contacta Supabase ni Turnstile.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-teal-600" aria-hidden="true" />
                    El mapa de confusión ya está preparado.
                  </li>
                </ul>
              </aside>
            </section>
          )}

          {currentStep === 1 && (
            <section className="space-y-9">
              <Alert title="La señal llegó al panel" tone="success">
                Esta respuesta pertenece al Pulso {DEMO_PULSE_ONE.ordinal}. En
                una clase real aparecería mediante Realtime; aquí se simula
                completamente en el navegador.
              </Alert>

              <ResponseSummary responses={firstPulseResponses} />

              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
                      Pulso {DEMO_PULSE_ONE.ordinal} · Entrada anónima
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#071a2b]">
                      Así ve el profesor las respuestas
                    </h2>
                  </div>
                  <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800">
                    <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    Simulación en vivo
                  </span>
                </div>
                <ResponseFeed responses={firstPulseResponses.slice(0, 6)} />
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section>
              <Alert className="mb-4" title="Resultado precargado para la demo">
                Este mapa pertenece únicamente al Pulso {DEMO_PULSE_ONE.ordinal}
                {' '}y representa lo que produciría el análisis del salón de 20
                personas. Abrir esta pantalla no realiza una petición a OpenAI.
              </Alert>
              <ConfusionMapPanel
                analyses={[DEMO_ANALYSIS]}
                analysis={DEMO_ANALYSIS}
                error={null}
                isAnalyzing={false}
                isLoading={false}
                latestResponseAt={DEMO_ANALYSIS.source_latest_response_at}
                latestRun={DEMO_ANALYSIS}
                onAnalyze={keepDemoStatic}
                responseCount={firstPulseResponses.length}
                responsesReady
              />
            </section>
          )}

          {currentStep === 3 && (
            <section className="space-y-9">
              {!hasSubmittedSecondPulse ? (
                <>
                  <Alert title={`Pulso ${DEMO_PULSE_TWO.ordinal} abierto`} tone="success">
                    El profesor aplicó una explicación breve y abrió otra
                    medición. El código <strong>{DEMO_SESSION.code}</strong> y el
                    enlace siguen siendo los mismos.
                  </Alert>

                  <form
                    className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(7,26,43,0.07)] sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
                    noValidate
                    onSubmit={submitSecondSignal}
                  >
                    <div>
                      <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
                        Pulso {DEMO_PULSE_TWO.ordinal} · Segunda medición
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#071a2b] sm:text-3xl">
                        Cuéntale al profesor cómo vas ahora
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                        No es un cuestionario: vuelves a elegir una de las tres
                        señales después de la intervención docente.
                      </p>

                      <div className="mt-7">
                        <StatusSelector
                          error={secondStatusError}
                          onChange={(nextStatus) => {
                            setSecondStatus(nextStatus)
                            setSecondStatusError(undefined)
                          }}
                          value={secondStatus}
                        />
                      </div>

                      <label
                        className="mt-6 block text-sm font-extrabold text-slate-900"
                        htmlFor="demo-second-question"
                      >
                        ¿Qué te genera duda ahora?{' '}
                        <span className="font-semibold text-slate-400">(opcional)</span>
                      </label>
                      <textarea
                        className="form-input mt-2 min-h-28 resize-y py-3"
                        id="demo-second-question"
                        maxLength={1000}
                        onChange={(event) => setSecondQuestionText(event.target.value)}
                        placeholder="Ej. Ya entendí las componentes, pero todavía dudo con el ángulo…"
                        value={secondQuestionText}
                      />
                      <p className="mt-1 text-right text-xs font-semibold text-slate-400">
                        {secondQuestionText.length}/1000
                      </p>

                      <Button className="mt-6" type="submit">
                        Enviar Pulso {DEMO_PULSE_TWO.ordinal} y comparar
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>

                    <aside className="mt-7 rounded-2xl border border-teal-100 bg-teal-50/70 p-5 lg:mt-0">
                      <span className="grid size-11 place-items-center rounded-xl bg-teal-700 text-white">
                        <RotateCcw className="size-5" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 font-extrabold text-[#071a2b]">
                        Mismo grupo, nuevo momento
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Cada navegador puede responder una vez por pulso. Los
                        resultados se comparan de forma agregada y las señales
                        anteriores se conservan.
                      </p>
                    </aside>
                  </form>
                </>
              ) : (
                <>
                  <Alert title={`Respuesta enviada al Pulso ${DEMO_PULSE_TWO.ordinal}`} tone="success">
                    La segunda medición quedó registrada en esta pestaña. Ahora
                    puedes comparar el grupo antes y después de la intervención.
                  </Alert>

                  <DemoPulseComparison
                    firstResponses={firstPulseResponses}
                    secondResponses={secondPulseResponses}
                  />

                  <div>
                    <Alert className="mb-5" title="Resultado final dentro del historial">
                      Para comparar clases, ClassSignal usa el último pulso con
                      respuestas de cada sesión. La primera barra incorpora el
                      resultado del Pulso {DEMO_PULSE_TWO.ordinal} que acabas de
                      simular.
                    </Alert>
                    <CoursePulseHistory points={history} />
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        {currentStep > 0 && (
          <div className="mt-7 flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={() => goToStep(currentStep - 1)} variant="secondary">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Paso anterior
            </Button>

            {currentStep < demoSteps.length - 1 ? (
              <Button onClick={() => goToStep(currentStep + 1)}>
                {currentStep === 1
                  ? 'Ver mapa precargado'
                  : `Abrir Pulso ${DEMO_PULSE_TWO.ordinal}`}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : hasSubmittedSecondPulse ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={resetDemo} variant="secondary">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reiniciar demo
                </Button>
                <Link
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#315cf6] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(49,92,246,0.18)] transition hover:bg-[#254bd4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  to="/profesor/login"
                >
                  Entrar como profesor
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs leading-5 font-semibold text-slate-500">
          <RadioTower className="size-4 text-teal-600" aria-hidden="true" />
          Demo local con datos simulados; ninguna acción modifica clases reales.
        </p>
      </div>
    </main>
  )
}
