import { useCallback, useEffect, useRef, useState } from 'react'

import { getErrorMessage } from '../lib/errors'
import {
  AnalysisInvocationError,
  analyzeSession,
  getSessionAnalyses,
} from '../services/analyses.service'
import {
  analysisPendingTimeoutMs,
  type SessionAnalysis,
} from '../types/domain'

function analysisKey(sessionId: string | undefined, pulseId: string | undefined) {
  return sessionId && pulseId ? `${sessionId}:${pulseId}` : undefined
}

export function useSessionAnalyses(
  sessionId: string | undefined,
  pulseId: string | undefined,
) {
  const [analyses, setAnalyses] = useState<SessionAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId && pulseId))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestKey = analysisKey(sessionId, pulseId)
  const activeRequestKey = useRef<string | undefined>(requestKey)
  const errorPendingRunId = useRef<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!sessionId || !pulseId) return
    if (!silent) setIsLoading(true)

    try {
      const currentAnalyses = await getSessionAnalyses(sessionId, pulseId)
      if (activeRequestKey.current !== requestKey) return
      setAnalyses(currentAnalyses)
      const pendingRunId = errorPendingRunId.current
      const latest = currentAnalyses[0]
      if (pendingRunId && latest?.id === pendingRunId && latest.status !== 'pending') {
        errorPendingRunId.current = null
        setError(null)
      }
      return currentAnalyses
    } catch (refreshError) {
      if (activeRequestKey.current !== requestKey || silent) return
      setError(
        getErrorMessage(
          refreshError,
          'No pudimos cargar el historial de análisis.',
        ),
      )
    } finally {
      if (!silent && activeRequestKey.current === requestKey) setIsLoading(false)
    }
  }, [pulseId, requestKey, sessionId])

  useEffect(() => {
    if (!sessionId || !pulseId) {
      activeRequestKey.current = undefined
      setAnalyses([])
      setIsLoading(false)
      setIsAnalyzing(false)
      setError(null)
      errorPendingRunId.current = null
      return undefined
    }

    activeRequestKey.current = requestKey
    setAnalyses([])
    setError(null)
    setIsAnalyzing(false)
    errorPendingRunId.current = null
    void refresh()

    return () => {
      if (activeRequestKey.current === requestKey) activeRequestKey.current = undefined
    }
  }, [refresh, requestKey, sessionId])

  const latestRun = analyses[0] ?? null
  const latestCompleted = analyses.find(
    (analysis) => analysis.status === 'completed' && analysis.result,
  ) ?? null

  useEffect(() => {
    if (latestRun?.status !== 'pending') return undefined

    const expiresIn = Date.parse(latestRun.created_at)
      + analysisPendingTimeoutMs
      - Date.now()
    if (expiresIn <= 0) return undefined

    const interval = window.setInterval(() => {
      void refresh(true)
    }, 4000)

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval)
      void refresh(true)
    }, expiresIn)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [latestRun?.created_at, latestRun?.status, refresh])

  const runAnalysis = useCallback(async () => {
    if (!sessionId || !pulseId) return

    const attemptStartedAt = Date.now()
    setIsAnalyzing(true)
    setError(null)

    try {
      const { analysis } = await analyzeSession(sessionId, pulseId)
      if (activeRequestKey.current !== requestKey) return

      setAnalyses((current) => [
        analysis,
        ...current.filter((item) => item.id !== analysis.id),
      ])
      errorPendingRunId.current = null
    } catch (analysisError) {
      if (activeRequestKey.current !== requestKey) return
      const message = getErrorMessage(
        analysisError,
        'No pudimos generar el mapa de confusión.',
      )
      const refreshedAnalyses = await refresh(true)
      if (activeRequestKey.current !== requestKey) return
      const refreshedLatest = refreshedAnalyses?.[0]
      const completedDuringAttempt = refreshedLatest?.status === 'completed'
        && refreshedLatest.completed_at
        && Date.parse(refreshedLatest.completed_at) >= attemptStartedAt - 1000
      if (
        completedDuringAttempt
        || (
          analysisError instanceof AnalysisInvocationError
          && analysisError.code === 'analysis_in_progress'
          && refreshedLatest?.status === 'completed'
        )
      ) {
        errorPendingRunId.current = null
        setError(null)
        return
      }
      errorPendingRunId.current = refreshedLatest?.status === 'pending'
        ? refreshedLatest.id
        : null
      setError(message)
    } finally {
      if (activeRequestKey.current === requestKey) setIsAnalyzing(false)
    }
  }, [pulseId, refresh, requestKey, sessionId])

  return {
    analyses,
    latestRun,
    latestCompleted,
    isLoading,
    isAnalyzing,
    error,
    refresh,
    runAnalysis,
  }
}
