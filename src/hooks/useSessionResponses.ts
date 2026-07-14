import { useCallback, useEffect, useRef, useState } from 'react'

import { getErrorMessage } from '../lib/errors'
import {
  getSessionResponses,
  subscribeToSessionResponses,
  unsubscribeFromResponses,
} from '../services/responses.service'
import type { StudentResponse } from '../types/domain'

export function useSessionResponses(sessionId: string | undefined) {
  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING')
  const activeSessionId = useRef<string | undefined>(sessionId)

  const refresh = useCallback(async () => {
    if (!sessionId) return

    setIsLoading(true)
    setError(null)

    try {
      const initialResponses = await getSessionResponses(sessionId)
      if (activeSessionId.current !== sessionId) return
      setResponses((current) => {
        const byId = new Map(
          [...current, ...initialResponses].map((response) => [response.id, response]),
        )
        return Array.from(byId.values()).sort(
          (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
        )
      })
    } catch (refreshError) {
      if (activeSessionId.current !== sessionId) return
      setError(
        getErrorMessage(
          refreshError,
          'No pudimos cargar las respuestas de esta sesión.',
        ),
      )
    } finally {
      if (activeSessionId.current === sessionId) setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return undefined

    activeSessionId.current = sessionId
    setResponses([])
    setRealtimeStatus('CONNECTING')

    const channel = subscribeToSessionResponses(
      sessionId,
      (response) => {
        if (activeSessionId.current !== sessionId) return
        setResponses((current) => {
          if (current.some((item) => item.id === response.id)) return current
          return [response, ...current]
        })
      },
      (status) => {
        if (activeSessionId.current !== sessionId) return

        setRealtimeStatus(status)
        if (status === 'SUBSCRIBED') void refresh()
      },
    )

    void refresh()

    return () => {
      if (activeSessionId.current === sessionId) activeSessionId.current = undefined
      void unsubscribeFromResponses(channel)
    }
  }, [refresh, sessionId])

  return {
    responses,
    isLoading,
    error,
    realtimeStatus,
    refresh,
  }
}
