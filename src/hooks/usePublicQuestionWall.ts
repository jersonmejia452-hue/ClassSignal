import { useCallback, useEffect, useRef, useState } from 'react'

import { getStudentQuestionWall } from '../services/questions.service'
import type { PublicSessionQuestion } from '../types/domain'

const questionWallPollingIntervalMs = 15_000

export function usePublicQuestionWall(
  sessionId: string | undefined,
  pulseId: string | undefined,
) {
  const [questions, setQuestions] = useState<PublicSessionQuestion[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(Boolean(sessionId))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeSessionIdRef = useRef<string | undefined>(sessionId)
  const activePulseIdRef = useRef<string | undefined>(pulseId)
  const loadedSessionIdRef = useRef<string | undefined>(undefined)
  const loadedPulseIdRef = useRef<string | undefined>(undefined)
  const isRequestInFlightRef = useRef(false)
  const refreshPendingRef = useRef(false)
  const refreshRef = useRef<() => Promise<void>>(async () => undefined)

  const refresh = useCallback(async () => {
    const targetSessionId = sessionId
    const targetPulseId = pulseId
    if (
      !targetSessionId
      || !targetPulseId
      || activeSessionIdRef.current !== targetSessionId
      || activePulseIdRef.current !== targetPulseId
    ) return

    if (isRequestInFlightRef.current) {
      refreshPendingRef.current = true
      return
    }

    isRequestInFlightRef.current = true
    const isInitialRequest = loadedSessionIdRef.current !== targetSessionId
      || loadedPulseIdRef.current !== targetPulseId

    if (isInitialRequest) setIsInitialLoading(true)
    else setIsRefreshing(true)

    try {
      const payload = await getStudentQuestionWall(targetSessionId, targetPulseId)
      if (
        activeSessionIdRef.current !== targetSessionId
        || activePulseIdRef.current !== targetPulseId
      ) return

      setIsVisible(payload.visible)
      setQuestions(payload.visible ? payload.questions : [])
      setHasLoaded(true)
      setError(null)
      loadedSessionIdRef.current = targetSessionId
      loadedPulseIdRef.current = targetPulseId
    } catch {
      if (
        activeSessionIdRef.current !== targetSessionId
        || activePulseIdRef.current !== targetPulseId
      ) return
      setError('No pudimos actualizar las dudas compartidas. Inténtalo nuevamente.')
    } finally {
      if (
        activeSessionIdRef.current === targetSessionId
        && activePulseIdRef.current === targetPulseId
      ) {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }

      isRequestInFlightRef.current = false
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false
        void refreshRef.current()
      }
    }
  }, [pulseId, sessionId])

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    activeSessionIdRef.current = sessionId
    activePulseIdRef.current = pulseId
    loadedSessionIdRef.current = undefined
    loadedPulseIdRef.current = undefined
    refreshPendingRef.current = false
    setQuestions([])
    setIsVisible(false)
    setHasLoaded(false)
    setError(null)
    setIsInitialLoading(Boolean(sessionId && pulseId))
    setIsRefreshing(false)

    if (!sessionId || !pulseId) return undefined

    if (document.visibilityState === 'visible') void refreshRef.current()

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshRef.current()
    }
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshRef.current()
    }, questionWallPollingIntervalMs)

    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      if (
        activeSessionIdRef.current === sessionId
        && activePulseIdRef.current === pulseId
      ) {
        activeSessionIdRef.current = undefined
        activePulseIdRef.current = undefined
      }
    }
  }, [pulseId, sessionId])

  return {
    questions,
    isVisible,
    hasLoaded,
    isInitialLoading,
    isRefreshing,
    error,
    refresh,
  }
}
