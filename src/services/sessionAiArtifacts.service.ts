import {
  sessionAiArtifactErrorSchema,
  sessionAiArtifactGenerationRequestSchema,
  sessionAiArtifactInvocationSchema,
  sessionAiArtifactListSchema,
  type SessionAiArtifactGenerationRequest,
} from '../schemas/sessionAiArtifact'
import type {
  SessionAiArtifact,
  SessionAiArtifactKind,
  SessionAiArtifactInvocation,
} from '../types/domain'
import { getTeacherSupabase } from './supabase'

export class SessionAiArtifactInvocationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'SessionAiArtifactInvocationError'
  }
}

export async function getSessionAiArtifacts(
  sessionId: string,
  kind: SessionAiArtifactKind,
) {
  const { data, error } = await getTeacherSupabase()
    .from('session_ai_artifacts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const parsed = sessionAiArtifactListSchema.safeParse(data ?? [])
  if (!parsed.success) {
    throw new Error('El historial de artefactos de IA tiene un formato inesperado.')
  }

  return parsed.data as SessionAiArtifact[]
}

export async function getLatestCompletedSessionAnalysisAt(sessionId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('session_analyses')
    .select('completed_at')
    .eq('session_id', sessionId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return typeof data?.completed_at === 'string' ? data.completed_at : null
}

async function readFunctionError(error: unknown) {
  if (
    typeof error === 'object'
    && error !== null
    && 'context' in error
    && error.context instanceof Response
  ) {
    try {
      const payload: unknown = await error.context.clone().json()
      const parsed = sessionAiArtifactErrorSchema.safeParse(payload)
      if (parsed.success) {
        return {
          code: parsed.data.error.code ?? 'artifact_generation_failed',
          message: parsed.data.error.message,
        }
      }
    } catch {
      // Gateways do not always preserve the function's JSON error body.
    }
  }

  return {
    code: 'artifact_generation_failed',
    message: 'No pudimos generar el recurso con IA. Intenta nuevamente.',
  }
}

export async function generateSessionAiArtifact(
  request: SessionAiArtifactGenerationRequest,
) {
  const parsedRequest = sessionAiArtifactGenerationRequestSchema.safeParse(request)
  if (!parsedRequest.success) {
    throw new SessionAiArtifactInvocationError(
      'La solicitud para generar el recurso no es válida.',
      'invalid_artifact_request',
    )
  }

  const { data, error } = await getTeacherSupabase().functions.invoke(
    'generate-session-artifact',
    { body: parsedRequest.data },
  )

  if (error) {
    const publicError = await readFunctionError(error)
    throw new SessionAiArtifactInvocationError(publicError.message, publicError.code)
  }

  const parsed = sessionAiArtifactInvocationSchema.safeParse(data)
  if (!parsed.success) {
    throw new SessionAiArtifactInvocationError(
      'La función devolvió un recurso con formato inesperado.',
      'invalid_artifact_response',
    )
  }

  return parsed.data as SessionAiArtifactInvocation
}
