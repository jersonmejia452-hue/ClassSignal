import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

import { loadTurnstile } from '../../services/turnstile.service'
import type {
  TurnstileApi,
  TurnstileStatus,
  TurnstileWidgetId,
} from '../../types/turnstile'

export interface InvisibleTurnstileHandle {
  execute: () => Promise<string>
  reset: () => void
}

interface InvisibleTurnstileProps {
  action: string
  cData: string
  siteKey: string
  onStatusChange: (status: TurnstileStatus) => void
}

interface PendingChallenge {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

export const InvisibleTurnstile = forwardRef<
  InvisibleTurnstileHandle,
  InvisibleTurnstileProps
>(function InvisibleTurnstile(
  { action, cData, siteKey, onStatusChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<TurnstileApi | null>(null)
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)
  const pendingRef = useRef<PendingChallenge | null>(null)

  const rejectPending = useCallback((message: string) => {
    pendingRef.current?.reject(new Error(message))
    pendingRef.current = null
  }, [])

  useImperativeHandle(ref, () => ({
    execute: () => {
      const api = apiRef.current
      const widgetId = widgetIdRef.current
      if (!api || !widgetId) {
        return Promise.reject(
          new Error('La verificación segura aún no está lista.'),
        )
      }

      rejectPending('La verificación anterior fue reemplazada.')
      onStatusChange('running')

      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { resolve, reject }
        try {
          api.reset(widgetId)
          api.execute(widgetId)
        } catch {
          pendingRef.current = null
          onStatusChange('ready')
          reject(new Error('No pudimos iniciar la verificación segura.'))
        }
      })
    },
    reset: () => {
      rejectPending('La verificación segura se reinició.')
      if (apiRef.current && widgetIdRef.current) {
        apiRef.current.reset(widgetIdRef.current)
        onStatusChange('ready')
      }
    },
  }), [onStatusChange, rejectPending])

  useEffect(() => {
    let isMounted = true
    onStatusChange('loading')

    const settleAsRetryableError = (message: string) => {
      if (!isMounted) return
      rejectPending(message)
      onStatusChange('ready')
    }

    void loadTurnstile()
      .then((api) => {
        if (!isMounted || !containerRef.current) return

        apiRef.current = api
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          action,
          cData,
          execution: 'execute',
          language: 'es',
          retry: 'never',
          'refresh-expired': 'manual',
          'response-field': false,
          callback: (token) => {
            if (!isMounted) return
            if (!token) {
              settleAsRetryableError('Turnstile no devolvió una verificación válida.')
              return
            }

            pendingRef.current?.resolve(token)
            pendingRef.current = null
            onStatusChange('ready')
          },
          'error-callback': () => {
            settleAsRetryableError(
              'No pudimos completar la verificación segura. Intenta otra vez.',
            )
            return true
          },
          'expired-callback': () => {
            settleAsRetryableError(
              'La verificación segura expiró. Intenta otra vez.',
            )
          },
          'timeout-callback': () => {
            settleAsRetryableError(
              'La verificación segura tardó demasiado. Intenta otra vez.',
            )
          },
          'unsupported-callback': () => {
            rejectPending(
              'Este navegador no permite completar la verificación segura.',
            )
            onStatusChange('error')
          },
        })
        onStatusChange('ready')
      })
      .catch(() => {
        if (isMounted) onStatusChange('error')
      })

    return () => {
      isMounted = false
      rejectPending('La verificación segura se canceló.')

      if (apiRef.current && widgetIdRef.current) {
        apiRef.current.remove(widgetIdRef.current)
      }
      apiRef.current = null
      widgetIdRef.current = null
    }
  }, [action, cData, onStatusChange, rejectPending, siteKey])

  return <div ref={containerRef} />
})
