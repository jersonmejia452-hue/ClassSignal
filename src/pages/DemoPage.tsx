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
  DEMO_ANALYSIS,
  DEMO_COURSE,
  DEMO_DEFAULT_SIGNAL,
  DEMO_PULSE_HISTORY,
  DEMO_SESSION,
} from '../demo/classsignal-demo.data'
import { buildStatusSummary } from '../lib/format'
import type {
  CoursePulsePoint,
  UnderstandingStatus,
} from '../types/domain'

function buildInteractiveHistory(
  responses: ReturnType<typeof createDemoResponses>,
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
  const stepRegionRef = useRef<HTMLDivElement>(null)
  const shouldFocusStep = useRef(false)

  const responses = useMemo(
    () => createDemoResponses({
      status: status ?? DEMO_DEFAULT_SIGNAL.status,
      questionText,
    }),
    [questionText, status],
  )
  const history = useMemo(
    () => buildInteractiveHistory(responses),
    [responses],
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
    changeStep(1)
  }

  const goToStep = (nextStep: number) => {
    changeStep(nextStep)
  }

  const resetDemo = () => {
    setStatus(null)
    setQuestionText('')
    setStatusError(undefined)
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
              Demo interactiva · 90 segundos
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl leading-tight font-black tracking-[-0.045em] sm:text-5xl">
              Sigue la señal desde el estudiante hasta la decisión docente.
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
                  Paso 1 · Vista estudiante
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
                En una clase real aparecería mediante Realtime. Aquí la
                actualización se simula completamente en el navegador.
              </Alert>

              <ResponseSummary responses={responses} />

              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
                      Entrada anónima
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
                <ResponseFeed responses={responses.slice(0, 6)} />
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section>
              <Alert className="mb-4" title="Resultado precargado para la demo">
                Este mapa representa lo que produciría el análisis del salón de
                20 personas. Abrir esta pantalla no realiza una petición a
                OpenAI.
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
                responseCount={responses.length}
                responsesReady
              />
            </section>
          )}

          {currentStep === 3 && (
            <section>
              <Alert className="mb-5" title="Escenario simulado de cuatro clases">
                La primera medición incorpora la señal que elegiste. Las tres
                siguientes muestran cómo el profesor podría comprobar si sus
                ajustes pedagógicos están funcionando.
              </Alert>
              <CoursePulseHistory points={history} />
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
                  : 'Ver pulso histórico'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
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
            )}
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
