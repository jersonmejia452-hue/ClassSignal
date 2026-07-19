import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getErrorMessage,
  getSessionLifecycleErrorMessage,
} from '../lib/errors'
import {
  getSessionPulses,
  openNextSessionPulse,
  subscribeToSessionPulses,
  unsubscribeFromSessionPulses,
} from '../services/pulses.service'
import type { SessionPulse } from '../types/domain'

export function useSessionPulses(sessionId: string | undefined) {
  const [pulses, setPulses] = useState<SessionPulse[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING')
  const activeSessionId = useRef<string | undefined>(sessionId)

  const refresh = useCallback(async (silent = false) => {
    if (!sessionId) return undefined
    if (!silent) setIsLoading(true)

    try {
      const currentPulses = await getSessionPulses(sessionId)
      if (activeSessionId.current !== sessionId) return undefined
      setPulses(currentPulses)
      setError(null)
      return currentPulses
    } catch (refreshError) {
      if (activeSessionId.current !== sessionId) return undefined
      if (!silent) {
        setError(getErrorMessage(
          refreshError,
          'No pudimos cargar los pulsos de esta clase.',
        ))
      }
      return undefined
    } finally {
      if (!silent && activeSessionId.current === sessionId) setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      activeSessionId.current = undefined
      setPulses([])
      setIsLoading(false)
      setRealtimeStatus('CONNECTING')
      return undefined
    }

    activeSessionId.current = sessionId
    setPulses([])
    setError(null)
    setIsLoading(true)
    setRealtimeStatus('CONNECTING')

    const channel = subscribeToSessionPulses(
      sessionId,
      () => {
        if (activeSessionId.current === sessionId) void refresh(true)
      },
      (status) => {
        if (activeSessionId.current !== sessionId) return
        setRealtimeStatus(status)
        if (status === 'SUBSCRIBED') void refresh(true)
      },
    )

    void refresh()

    return () => {
      if (activeSessionId.current === sessionId) activeSessionId.current = undefined
      void unsubscribeFromSessionPulses(channel)
    }
  }, [refresh, sessionId])

  const openNextPulse = useCallback(async () => {
    if (!sessionId || isOpening) return undefined

    setIsOpening(true)
    setError(null)
    try {
      const openedPulse = await openNextSessionPulse(sessionId)
      if (activeSessionId.current !== sessionId) return undefined

      setPulses((current) => [
        ...current.filter((pulse) => pulse.id !== openedPulse.id),
        openedPulse,
      ].map((pulse) => (
        pulse.id === openedPulse.id || !pulse.is_active
          ? pulse
          : { ...pulse, is_active: false, ended_at: openedPulse.started_at }
      )).sort((a, b) => a.ordinal - b.ordinal))
      void refresh(true)
      return openedPulse
    } catch (openError) {
      if (activeSessionId.current === sessionId) {
        setError(getSessionLifecycleErrorMessage(
          openError,
          'No pudimos abrir el siguiente pulso.',
        ))
      }
      return undefined
    } finally {
      if (activeSessionId.current === sessionId) setIsOpening(false)
    }
  }, [isOpening, refresh, sessionId])

  const activePulse = useMemo(
    () => pulses.find((pulse) => pulse.is_active) ?? null,
    [pulses],
  )

  return {
    pulses,
    activePulse,
    loading: isLoading,
    isLoading,
    error,
    realtimeStatus,
    refresh,
    openNextPulse,
    isOpening,
  }
}
