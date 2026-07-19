import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PauseCircle, PlayCircle, Radio, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { ConfusionMapPanel } from '../../components/analysis/ConfusionMapPanel'
import { PulseComparison } from '../../components/pulses/PulseComparison'
import { PulseSelector } from '../../components/pulses/PulseSelector'
import { SessionPulseControl } from '../../components/pulses/SessionPulseControl'
import { StudentQuestionWallControl } from '../../components/questions/StudentQuestionWallControl'
import { ResponseFeed } from '../../components/responses/ResponseFeed'
import { ResponseSummary } from '../../components/responses/ResponseSummary'
import { ShareSessionCard } from '../../components/sessions/ShareSessionCard'
import { SessionStatusBadge } from '../../components/sessions/SessionStatusBadge'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSessionAnalyses } from '../../hooks/useSessionAnalyses'
import { useSessionPulses } from '../../hooks/useSessionPulses'
import { useSessionResponses } from '../../hooks/useSessionResponses'
import { cn } from '../../lib/cn'
import {
  getErrorMessage,
  getSessionLifecycleErrorMessage,
} from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import {
  getSessionById,
  setSessionActive,
} from '../../services/sessions.service'
import { setPulseQuestionsVisible } from '../../services/pulses.service'
import { setResponseStudentVisibility } from '../../services/responses.service'
import {
  analysisResponseLimit,
  type ClassSession,
} from '../../types/domain'

interface DetailLocationState {
  justCreated?: boolean
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const locationState = location.state as DetailLocationState | null
  const [session, setSession] = useState<ClassSession | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [isToggling, setIsToggling] = useState(false)
  const [questionWallError, setQuestionWallError] = useState<string | null>(null)
  const [isTogglingQuestionWall, setIsTogglingQuestionWall] = useState(false)
  const [responseVisibilityError, setResponseVisibilityError] = useState<string | null>(null)
  const [updatingResponseId, setUpdatingResponseId] = useState<string | null>(null)
  const [selectedPulseId, setSelectedPulseId] = useState<string | null>(null)

  const {
    responses,
    isLoading: isLoadingResponses,
    error: responsesError,
    realtimeStatus: responsesRealtimeStatus,
    refresh: refreshResponses,
  } = useSessionResponses(session?.id)

  const {
    pulses,
    activePulse,
    isLoading: isLoadingPulses,
    error: pulsesError,
    realtimeStatus: pulsesRealtimeStatus,
    refresh: refreshPulses,
    openNextPulse,
    isOpening: isOpeningPulse,
  } = useSessionPulses(session?.id)

  const {
    analyses,
    latestRun: latestAnalysisRun,
    latestCompleted: latestCompletedAnalysis,
    isLoading: isLoadingAnalyses,
    isAnalyzing,
    error: analysisError,
    runAnalysis,
  } = useSessionAnalyses(
    selectedPulseId ? session?.id : undefined,
    selectedPulseId ?? undefined,
  )

  useEffect(() => {
    if (activePulse?.id) setSelectedPulseId(activePulse.id)
  }, [activePulse?.id])

  useEffect(() => {
    if (pulses.length === 0) {
      setSelectedPulseId(null)
      return
    }

    setSelectedPulseId((current) => (
      current && pulses.some((pulse) => pulse.id === current)
        ? current
        : pulses[pulses.length - 1]!.id
    ))
  }, [pulses])

  const selectedPulse = useMemo(
    () => pulses.find((pulse) => pulse.id === selectedPulseId) ?? null,
    [pulses, selectedPulseId],
  )
  const selectedResponses = useMemo(
    () => responses.filter((response) => response.pulse_id === selectedPulseId),
    [responses, selectedPulseId],
  )
  const activeResponses = useMemo(
    () => activePulse
      ? responses.filter((response) => response.pulse_id === activePulse.id)
      : [],
    [activePulse, responses],
  )
  const previousPulse = useMemo(() => {
    if (!selectedPulse) return null
    return [...pulses]
      .filter((pulse) => pulse.ordinal < selectedPulse.ordinal)
      .sort((first, second) => second.ordinal - first.ordinal)[0] ?? null
  }, [pulses, selectedPulse])
  const previousResponses = useMemo(
    () => previousPulse
      ? responses.filter((response) => response.pulse_id === previousPulse.id)
      : [],
    [previousPulse, responses],
  )
  const pulseOptions = useMemo(
    () => [...pulses]
      .sort((first, second) => second.ordinal - first.ordinal)
      .map((pulse) => ({
        id: pulse.id,
        isActive: pulse.is_active,
        ordinal: pulse.ordinal,
        responseCount: responses.filter((response) => response.pulse_id === pulse.id).length,
      })),
    [pulses, responses],
  )

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      if (!id) {
        setSessionError('La clase solicitada no es válida.')
        setIsLoadingSession(false)
        return
      }

      setIsLoadingSession(true)
      setSession(null)
      setSessionError(null)

      try {
        const result = await getSessionById(id)
        if (!isMounted) return
        setSession(result)
      } catch (error) {
        if (!isMounted) return
        setSessionError(
          getErrorMessage(error, 'No pudimos cargar esta clase.'),
        )
      } finally {
        if (isMounted) setIsLoadingSession(false)
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [id])

  const toggleSession = async () => {
    if (!session) return
    setIsToggling(true)
    setToggleError(null)

    try {
      setSession(await setSessionActive(session.id, !session.is_active))
      void refreshPulses()
    } catch (error) {
      setToggleError(
        getSessionLifecycleErrorMessage(
          error,
          'No pudimos cambiar el estado de la clase.',
        ),
      )
    } finally {
      setIsToggling(false)
    }
  }

  const toggleQuestionWall = async () => {
    if (!session?.is_active || !selectedPulse?.is_active) return

    setIsTogglingQuestionWall(true)
    setQuestionWallError(null)

    try {
      await setPulseQuestionsVisible(
        selectedPulse.id,
        !selectedPulse.questions_visible_to_students,
      )
      await refreshPulses()
    } catch (error) {
      setQuestionWallError(
        getErrorMessage(error, 'No pudimos cambiar la visibilidad de las dudas.'),
      )
    } finally {
      setIsTogglingQuestionWall(false)
    }
  }

  const updateResponseVisibility = async (
    responseId: string,
    isVisibleToStudents: boolean,
  ) => {
    setUpdatingResponseId(responseId)
    setResponseVisibilityError(null)

    try {
      await setResponseStudentVisibility(responseId, isVisibleToStudents)
      await refreshResponses()
    } catch (error) {
      setResponseVisibilityError(
        getErrorMessage(error, 'No pudimos cambiar la visibilidad de esta duda.'),
      )
    } finally {
      setUpdatingResponseId(null)
    }
  }

  if (isLoadingSession) {
    return (
      <div aria-label="Cargando sesión" className="animate-pulse" role="status">
        <div className="h-5 w-36 rounded bg-slate-200" />
        <div className="mt-6 h-12 max-w-2xl rounded-xl bg-slate-200" />
        <div className="mt-3 h-6 max-w-xl rounded bg-slate-100" />
        <div className="mt-8 h-80 rounded-2xl bg-white" />
      </div>
    )
  }

  if (!session) {
    return (
      <div>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-slate-950" to="/profesor">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a mis cursos
        </Link>
        <div className="mt-6">
          <EmptyState
            icon={<Radio className="size-5" aria-hidden="true" />}
            title="No encontramos esta clase"
          >
            {sessionError || 'Puede que haya sido eliminada o pertenezca a otra cuenta docente.'}
          </EmptyState>
        </div>
      </div>
    )
  }

  const isRealtimeConnected = responsesRealtimeStatus === 'SUBSCRIBED'
    && pulsesRealtimeStatus === 'SUBSCRIBED'
  const hasRealtimeError = [responsesRealtimeStatus, pulsesRealtimeStatus].some(
    (status) => ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status),
  )

  return (
    <div>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to={session.course_id ? `/profesor/curso/${session.course_id}` : '/profesor'}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {session.course_id ? 'Volver al curso' : 'Volver a mis cursos'}
      </Link>

      {locationState?.justCreated && (
        <Alert className="mt-4" title="Clase creada" tone="success">
          Ya puedes proyectar el código o compartir el enlace con tus estudiantes.
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <SessionStatusBadge isActive={session.is_active} />
            <p className="text-xs font-extrabold tracking-[0.12em] text-blue-700 uppercase">
              {session.subject}
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {session.title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            {session.topic}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            Creada {formatDateTime(session.created_at)}
          </p>
        </div>

        <Button
          className="shrink-0"
          disabled={isTogglingQuestionWall || isOpeningPulse}
          isLoading={isToggling}
          onClick={toggleSession}
          variant={session.is_active ? 'danger' : 'secondary'}
        >
          {session.is_active ? (
            <PauseCircle className="size-4" aria-hidden="true" />
          ) : (
            <PlayCircle className="size-4" aria-hidden="true" />
          )}
          {session.is_active ? 'Finalizar clase' : 'Reactivar clase'}
        </Button>
      </div>

      {toggleError && <Alert className="mt-5" tone="error">{toggleError}</Alert>}
      {!session.is_active && (
        <Alert className="mt-5">
          La clase está finalizada. El enlace seguirá mostrando el tema, pero no aceptará respuestas hasta que la reactives.
        </Alert>
      )}

      <div className="mt-8">
        <ShareSessionCard session={session} />
      </div>

      <div className="mt-5">
        <SessionPulseControl
          activePulseOrdinal={activePulse?.ordinal}
          activePulseStartedAt={activePulse?.started_at}
          activeResponseCount={activeResponses.length}
          error={pulsesError}
          isLoading={isLoadingPulses || isLoadingResponses}
          isOpening={isOpeningPulse}
          isSessionActive={session.is_active}
          onOpenNext={openNextPulse}
          onRetry={refreshPulses}
          pulseCount={pulses.length}
        />
      </div>

      {isLoadingPulses && pulses.length === 0 ? (
        <div className="mt-5 h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-label="Cargando pulsos" role="status" />
      ) : selectedPulse ? (
        <>
          <div className="mt-5">
            <PulseSelector
              onChange={setSelectedPulseId}
              options={pulseOptions}
              value={selectedPulse.id}
            />
          </div>

          <div className="mt-5">
            <StudentQuestionWallControl
              disabledReason={selectedPulse.is_active
                ? undefined
                : 'Selecciona el pulso activo para cambiar el muro que ven los estudiantes.'}
              error={questionWallError}
              isActive={session.is_active && selectedPulse.is_active}
              isUpdating={isTogglingQuestionWall || isToggling}
              isVisible={selectedPulse.questions_visible_to_students}
              onToggle={toggleQuestionWall}
              responses={selectedResponses}
              sessionCode={session.code}
            />
          </div>

          <div className="mt-10">
            <ResponseSummary responses={selectedResponses} />
            {previousPulse && (
              <PulseComparison
                currentOrdinal={selectedPulse.ordinal}
                currentResponses={selectedResponses}
                previousOrdinal={previousPulse.ordinal}
                previousResponses={previousResponses}
              />
            )}
          </div>

          <div className="mt-10">
            <ConfusionMapPanel
              analyses={analyses}
              analysis={latestCompletedAnalysis}
              error={analysisError}
              isAnalyzing={isAnalyzing}
              isLoading={isLoadingAnalyses}
              latestResponseAt={selectedResponses[0]?.created_at ?? null}
              latestRun={latestAnalysisRun}
              onAnalyze={runAnalysis}
              responseCount={Math.min(selectedResponses.length, analysisResponseLimit)}
              responsesReady={!isLoadingResponses && !responsesError}
            />
          </div>

          <section className="mt-10" aria-labelledby="responses-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
                  Entrada anónima · Pulso {selectedPulse.ordinal}
                </p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950" id="responses-title">
                  Respuestas recientes
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-extrabold', isRealtimeConnected ? 'bg-emerald-50 text-emerald-800' : hasRealtimeError ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')} role="status">
                  <span className={cn('size-2 rounded-full', isRealtimeConnected ? 'bg-emerald-500' : hasRealtimeError ? 'bg-red-500' : 'animate-pulse bg-amber-500')} aria-hidden="true" />
                  {isRealtimeConnected ? 'En vivo' : hasRealtimeError ? 'Sin conexión' : 'Conectando'}
                </span>
                <Button
                  aria-label="Actualizar respuestas y pulsos"
                  className="min-h-10 px-3"
                  onClick={() => {
                    void refreshResponses()
                    void refreshPulses()
                  }}
                  variant="ghost"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {responsesError && <Alert className="mb-4" tone="error">{responsesError}</Alert>}
            {responseVisibilityError && (
              <Alert className="mb-4" tone="error">{responseVisibilityError}</Alert>
            )}

            {isLoadingResponses && selectedResponses.length === 0 ? (
              <div className="space-y-3" aria-label="Cargando respuestas" role="status">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" key={index} />
                ))}
              </div>
            ) : (
              <ResponseFeed
                isStudentVisibilityDisabled={!session.is_active || !selectedPulse.is_active}
                onStudentVisibilityChange={updateResponseVisibility}
                responses={selectedResponses}
                updatingResponseId={updatingResponseId}
              />
            )}
          </section>
        </>
      ) : (
        <div className="mt-5">
          <EmptyState
            icon={<Radio className="size-5" aria-hidden="true" />}
            title="Esta clase todavía no tiene pulsos"
          >
            Abre el primer pulso para recibir señales, compartir dudas y generar un mapa de confusión.
          </EmptyState>
        </div>
      )}
    </div>
  )
}
