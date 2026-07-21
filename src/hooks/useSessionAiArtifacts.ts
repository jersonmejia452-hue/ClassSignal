import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getErrorMessage } from '../lib/errors'
import {
  generateSessionAiArtifact,
  getSessionAiArtifacts,
} from '../services/sessionAiArtifacts.service'
import {
  sessionAiArtifactPendingTimeoutMs,
  type SessionAiArtifact,
  type SessionAiArtifactKind,
} from '../types/domain'

interface GenerateArtifactOptions {
  pulseId?: string
  conceptIndex?: number
  regenerate?: boolean
}

function artifactKey(
  sessionId: string | undefined,
  kind: SessionAiArtifactKind,
) {
  return sessionId ? `${sessionId}:${kind}` : undefined
}

function sortNewestFirst(artifacts: SessionAiArtifact[]) {
  return [...artifacts].sort((first, second) => (
    Date.parse(second.created_at) - Date.parse(first.created_at)
    || second.id.localeCompare(first.id)
  ))
}

export function useSessionAiArtifacts(
  sessionId: string | undefined,
  kind: SessionAiArtifactKind,
) {
  const [artifacts, setArtifacts] = useState<SessionAiArtifact[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(sessionId))
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInvocationWasCached, setLastInvocationWasCached] = useState(false)
  const [invocationInProgress, setInvocationInProgress] = useState(false)
  const requestKey = artifactKey(sessionId, kind)
  const activeRequestKey = useRef<string | undefined>(requestKey)
  const refreshSequence = useRef(0)
  const erroredPendingArtifactId = useRef<string | null>(null)

  const refreshArtifacts = useCallback(async (silent = false) => {
    if (!sessionId) return undefined
    const sequence = ++refreshSequence.current
    if (!silent) setIsLoading(true)

    try {
      const currentArtifacts = await getSessionAiArtifacts(sessionId, kind)
      if (
        activeRequestKey.current !== requestKey
        || sequence !== refreshSequence.current
      ) return undefined

      setArtifacts(currentArtifacts)
      const pendingId = erroredPendingArtifactId.current
      const pendingRun = pendingId
        ? currentArtifacts.find((artifact) => artifact.id === pendingId)
        : undefined
      if (pendingId && (!pendingRun || pendingRun.status !== 'pending')) {
        erroredPendingArtifactId.current = null
        setError(null)
      }
      if (!currentArtifacts.some((artifact) => artifact.status === 'pending')) {
        setInvocationInProgress(false)
      }
      return currentArtifacts
    } catch (refreshError) {
      if (
        activeRequestKey.current !== requestKey
        || sequence !== refreshSequence.current
        || silent
      ) return undefined
      setError(getErrorMessage(
        refreshError,
        'No pudimos cargar el historial de recursos generados con IA.',
      ))
      return undefined
    } finally {
      if (
        activeRequestKey.current === requestKey
        && sequence === refreshSequence.current
      ) setIsLoading(false)
    }
  }, [kind, requestKey, sessionId])

  useEffect(() => {
    if (!sessionId) {
      refreshSequence.current += 1
      activeRequestKey.current = undefined
      setArtifacts([])
      setIsLoading(false)
      setIsGenerating(false)
      setError(null)
      setLastInvocationWasCached(false)
      setInvocationInProgress(false)
      erroredPendingArtifactId.current = null
      return undefined
    }

    activeRequestKey.current = requestKey
    refreshSequence.current += 1
    setArtifacts([])
    setIsLoading(true)
    setIsGenerating(false)
    setError(null)
    setLastInvocationWasCached(false)
    setInvocationInProgress(false)
    erroredPendingArtifactId.current = null
    void refreshArtifacts()

    return () => {
      if (activeRequestKey.current === requestKey) activeRequestKey.current = undefined
    }
  }, [refreshArtifacts, requestKey, sessionId])

  const visibleArtifacts = activeRequestKey.current === requestKey ? artifacts : []
  const newestPending = visibleArtifacts.find((artifact) => artifact.status === 'pending')
  const pendingExpiresAt = newestPending
    ? Date.parse(newestPending.created_at) + sessionAiArtifactPendingTimeoutMs
    : null
  const hasTimedOutPending = pendingExpiresAt !== null && pendingExpiresAt <= Date.now()
  const hasLivePending = Boolean(newestPending && !hasTimedOutPending)

  useEffect(() => {
    if (!newestPending || hasTimedOutPending || pendingExpiresAt === null) return undefined

    const interval = window.setInterval(() => {
      void refreshArtifacts(true)
    }, 4_000)
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval)
      void refreshArtifacts(true)
    }, Math.max(0, pendingExpiresAt - Date.now()))

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [hasTimedOutPending, newestPending, pendingExpiresAt, refreshArtifacts])

  const generateArtifact = useCallback(async (options: GenerateArtifactOptions = {}) => {
    if (!sessionId || isGenerating) return undefined
    const generationKey = requestKey
    const completedBeforeAttempt = new Set(
      visibleArtifacts
        .filter((artifact) => artifact.status === 'completed')
        .map((artifact) => artifact.id),
    )
    setIsGenerating(true)
    setError(null)
    setLastInvocationWasCached(false)

    try {
      const request = kind === 'micro_intervention'
        ? {
            sessionId,
            kind,
            pulseId: options.pulseId ?? '',
            conceptIndex: options.conceptIndex ?? -1,
            ...(options.regenerate === undefined
              ? {}
              : { regenerate: options.regenerate }),
          } as const
        : {
            sessionId,
            kind,
            ...(options.regenerate === undefined
              ? {}
              : { regenerate: options.regenerate }),
          } as const
      const invocation = await generateSessionAiArtifact(request)
      if (activeRequestKey.current !== generationKey) return undefined

      setArtifacts((current) => sortNewestFirst([
        invocation.artifact,
        ...current.filter((artifact) => artifact.id !== invocation.artifact.id),
      ]))
      setLastInvocationWasCached(invocation.cached)
      setInvocationInProgress(Boolean(
        invocation.in_progress || invocation.artifact.status === 'pending'
      ))
      erroredPendingArtifactId.current = null
      return invocation
    } catch (generationError) {
      if (activeRequestKey.current !== generationKey) return undefined
      const refreshedArtifacts = await refreshArtifacts(true)
      if (activeRequestKey.current !== generationKey) return undefined
      const reconciledCompleted = refreshedArtifacts?.find((artifact) => (
        artifact.status === 'completed'
        && artifact.result
        && (
          kind === 'publication_draft'
          || (
            artifact.pulse_id === options.pulseId
            && artifact.concept_index === options.conceptIndex
          )
        )
        && !completedBeforeAttempt.has(artifact.id)
      ))
      if (reconciledCompleted) {
        erroredPendingArtifactId.current = null
        setInvocationInProgress(false)
        setError(null)
        return {
          artifact: reconciledCompleted,
          cached: false,
          in_progress: false,
        }
      }
      const refreshedPending = refreshedArtifacts?.find(
        (artifact) => artifact.status === 'pending',
      )
      erroredPendingArtifactId.current = refreshedPending?.id ?? null
      setInvocationInProgress(Boolean(refreshedPending))
      setError(getErrorMessage(
        generationError,
        'No pudimos generar el recurso con IA.',
      ))
      return undefined
    } finally {
      if (activeRequestKey.current === generationKey) setIsGenerating(false)
    }
  }, [isGenerating, kind, refreshArtifacts, requestKey, sessionId, visibleArtifacts])

  const latestCompleted = useMemo(
    () => visibleArtifacts.find(
      (artifact) => artifact.status === 'completed' && artifact.result,
    ) ?? null,
    [visibleArtifacts],
  )

  return {
    artifacts: visibleArtifacts,
    latestCompleted,
    isLoading,
    isGenerating,
    error,
    lastInvocationWasCached,
    inProgress: (invocationInProgress && !hasTimedOutPending) || hasLivePending,
    hasTimedOutPending,
    refresh: () => refreshArtifacts(false),
    generateArtifact,
  }
}
