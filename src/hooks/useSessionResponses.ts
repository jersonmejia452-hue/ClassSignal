import { useCallback, useEffect, useRef, useState } from 'react'

import { getErrorMessage } from '../lib/errors'
import {
  getSessionResponses,
  subscribeToSessionResponses,
  unsubscribeFromResponses,
} from '../services/responses.service'
import type { StudentResponse } from '../types/domain'

function responseKey(sessionId: string | undefined, pulseId: string | undefined) {
  return sessionId ? `${sessionId}:${pulseId ?? '*'}` : undefined
}

export function useSessionResponses(
  sessionId: string | undefined,
  pulseId?: string,
) {
  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING')
  const requestKey = responseKey(sessionId, pulseId)
  const activeRequestKey = useRef<string | undefined>(requestKey)

  const refresh = useCallback(async () => {
    if (!sessionId) return

    setIsLoading(true)
    setError(null)

    try {
      const initialResponses = await getSessionResponses(sessionId, pulseId)
      if (activeRequestKey.current !== requestKey) return
      setResponses((current) => {
        const byId = new Map(
          [...current, ...initialResponses].map((response) => [response.id, response]),
        )
        return Array.from(byId.values()).sort(
          (a, b) => (
            Date.parse(b.created_at) - Date.parse(a.created_at)
            || b.id.localeCompare(a.id)
          ),
        )
      })
    } catch (refreshError) {
      if (activeRequestKey.current !== requestKey) return
      setError(
        getErrorMessage(
          refreshError,
          'No pudimos cargar las respuestas de esta sesión.',
        ),
      )
    } finally {
      if (activeRequestKey.current === requestKey) setIsLoading(false)
    }
  }, [pulseId, requestKey, sessionId])

  useEffect(() => {
    if (!sessionId) {
      activeRequestKey.current = undefined
      setResponses([])
      setIsLoading(false)
      setError(null)
      setRealtimeStatus('CONNECTING')
      return undefined
    }

    activeRequestKey.current = requestKey
    setResponses([])
    setRealtimeStatus('CONNECTING')

    const channel = subscribeToSessionResponses(
      sessionId,
      (response) => {
        if (activeRequestKey.current !== requestKey) return
        setResponses((current) => {
          if (current.some((item) => item.id === response.id)) return current
          return [response, ...current]
        })
      },
      (status) => {
        if (activeRequestKey.current !== requestKey) return

        setRealtimeStatus(status)
        if (status === 'SUBSCRIBED') void refresh()
      },
      pulseId,
    )

    void refresh()

    return () => {
      if (activeRequestKey.current === requestKey) activeRequestKey.current = undefined
      void unsubscribeFromResponses(channel)
    }
  }, [pulseId, refresh, requestKey, sessionId])

  return {
    responses,
    isLoading: isLoading || Boolean(
      requestKey && activeRequestKey.current !== requestKey
    ),
    error,
    realtimeStatus,
    refresh,
  }
}
