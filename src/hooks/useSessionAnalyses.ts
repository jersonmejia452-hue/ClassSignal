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

export function useSessionAnalyses(sessionId: string | undefined) {
  const [analyses, setAnalyses] = useState<SessionAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeSessionId = useRef<string | undefined>(sessionId)
  const errorPendingRunId = useRef<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!sessionId) return
    if (!silent) setIsLoading(true)

    try {
      const currentAnalyses = await getSessionAnalyses(sessionId)
      if (activeSessionId.current !== sessionId) return
      setAnalyses(currentAnalyses)
      const pendingRunId = errorPendingRunId.current
      const latest = currentAnalyses[0]
      if (pendingRunId && latest?.id === pendingRunId && latest.status !== 'pending') {
        errorPendingRunId.current = null
        setError(null)
      }
      return currentAnalyses
    } catch (refreshError) {
      if (activeSessionId.current !== sessionId || silent) return
      setError(
        getErrorMessage(
          refreshError,
          'No pudimos cargar el historial de análisis.',
        ),
      )
    } finally {
      if (!silent && activeSessionId.current === sessionId) setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return undefined

    activeSessionId.current = sessionId
    setAnalyses([])
    setError(null)
    setIsAnalyzing(false)
    errorPendingRunId.current = null
    void refresh()

    return () => {
      if (activeSessionId.current === sessionId) activeSessionId.current = undefined
    }
  }, [refresh, sessionId])

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
    if (!sessionId) return

    const attemptStartedAt = Date.now()
    setIsAnalyzing(true)
    setError(null)

    try {
      const { analysis } = await analyzeSession(sessionId)
      if (activeSessionId.current !== sessionId) return

      setAnalyses((current) => [
        analysis,
        ...current.filter((item) => item.id !== analysis.id),
      ])
      errorPendingRunId.current = null
    } catch (analysisError) {
      if (activeSessionId.current !== sessionId) return
      const message = getErrorMessage(
        analysisError,
        'No pudimos generar el mapa de confusión.',
      )
      const refreshedAnalyses = await refresh(true)
      if (activeSessionId.current !== sessionId) return
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
      if (activeSessionId.current === sessionId) setIsAnalyzing(false)
    }
  }, [refresh, sessionId])

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
