import type { RealtimeChannel } from '@supabase/supabase-js'

import {
  responseSubmissionErrorSchema,
  responseSubmissionSecuritySchema,
  responseSubmissionSchema,
} from '../schemas/response'
import type {
  ResponseDraft,
  ResponseSubmissionSecurity,
  StudentResponse,
} from '../types/domain'
import { getPublicSupabase, getTeacherSupabase } from './supabase'

export class ResponseSubmissionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ResponseSubmissionError'
  }
}

export async function getSessionResponses(sessionId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('responses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as StudentResponse[]
}

export async function setResponseStudentVisibility(
  responseId: string,
  isVisibleToStudents: boolean,
) {
  const { data, error } = await getTeacherSupabase()
    .from('responses')
    .update({ is_visible_to_students: isVisibleToStudents })
    .eq('id', responseId)
    .select('*')
    .single()

  if (error) throw error
  return data as StudentResponse
}

async function parsePublicFunctionError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
) {
  if (
    typeof error === 'object'
    && error !== null
    && 'context' in error
    && error.context instanceof Response
  ) {
    try {
      const payload: unknown = await error.context.clone().json()
      const parsedError = responseSubmissionErrorSchema.safeParse(payload)
      if (parsedError.success) {
        return new ResponseSubmissionError(
          parsedError.data.error.message,
          parsedError.data.error.code,
        )
      }
    } catch {
      // La respuesta puede no contener JSON; devolvemos un error público estable.
    }
  }

  return new ResponseSubmissionError(fallbackMessage, fallbackCode)
}

export async function getResponseSubmissionSecurity(): Promise<ResponseSubmissionSecurity> {
  const { data, error } = await getPublicSupabase().functions.invoke(
    'submit-response',
    { method: 'GET' },
  )

  if (error) {
    throw await parsePublicFunctionError(
      error,
      'El envío seguro no está disponible temporalmente.',
      'security_configuration_failed',
    )
  }

  const parsed = responseSubmissionSecuritySchema.safeParse(data)
  if (!parsed.success) {
    throw new ResponseSubmissionError(
      'El servidor devolvió una configuración de seguridad inesperada.',
      'invalid_security_configuration',
    )
  }

  return parsed.data
}

export async function submitStudentResponse(
  values: ResponseDraft,
  turnstileToken: string,
) {
  const { data, error } = await getPublicSupabase().functions.invoke(
    'submit-response',
    { body: {
      sessionId: values.sessionId,
      anonymousId: values.anonymousId,
      status: values.status,
      questionText: values.questionText?.trim() || null,
      turnstileToken,
    } },
  )

  if (error) {
    throw await parsePublicFunctionError(
      error,
      'No pudimos enviar tu respuesta. Intenta nuevamente.',
      'submission_failed',
    )
  }

  const parsed = responseSubmissionSchema.safeParse(data)
  if (!parsed.success) {
    throw new ResponseSubmissionError(
      'El servidor devolvió una confirmación inesperada.',
      'invalid_submission_response',
    )
  }
}

export function subscribeToSessionResponses(
  sessionId: string,
  onInsert: (response: StudentResponse) => void,
  onStatus: (status: string) => void,
) {
  return getTeacherSupabase()
    .channel(`responses:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'responses',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => onInsert(payload.new as StudentResponse),
    )
    .subscribe((status) => onStatus(status))
}

export async function unsubscribeFromResponses(channel: RealtimeChannel) {
  await getTeacherSupabase().removeChannel(channel)
}
