import { z } from 'zod'

import {
  analysisErrorSchema,
  analysisInvocationSchema,
  sessionAnalysisSchema,
} from '../schemas/analysis'
import type { SessionAnalysis } from '../types/domain'
import { getTeacherSupabase } from './supabase'

const sessionAnalysisListSchema = z.array(sessionAnalysisSchema)

export class AnalysisInvocationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'AnalysisInvocationError'
  }
}

export async function getSessionAnalyses(
  sessionId: string,
  pulseId: string,
) {
  const { data, error } = await getTeacherSupabase()
    .from('session_analyses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('pulse_id', pulseId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  const parsed = sessionAnalysisListSchema.safeParse(data ?? [])
  if (!parsed.success) {
    throw new Error('El historial de análisis tiene un formato inesperado.')
  }

  return parsed.data as SessionAnalysis[]
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
      const parsed = analysisErrorSchema.safeParse(payload)
      if (parsed.success) {
        return {
          code: parsed.data.error.code ?? 'analysis_failed',
          message: parsed.data.error.message,
        }
      }
    } catch {
      // Fall back to the stable message below when the gateway has no JSON body.
    }
  }

  return {
    code: 'analysis_failed',
    message: 'No pudimos generar el mapa de confusión. Intenta nuevamente.',
  }
}

export async function analyzeSession(sessionId: string, pulseId: string) {
  const { data, error } = await getTeacherSupabase().functions.invoke(
    'analyze-session',
    { body: { sessionId, pulseId } },
  )

  if (error) {
    const publicError = await readFunctionError(error)
    throw new AnalysisInvocationError(publicError.message, publicError.code)
  }

  const parsed = analysisInvocationSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error('La función devolvió un análisis con formato inesperado.')
  }

  return parsed.data
}
