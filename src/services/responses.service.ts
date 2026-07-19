import type { RealtimeChannel } from '@supabase/supabase-js'

import {
  responseDraftSchema,
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

const responsePageSize = 1000
const maximumSessionResponses = 3000
const maximumPulseResponses = 500

export class ResponseSubmissionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ResponseSubmissionError'
  }
}

function sortNewestFirst(responses: StudentResponse[]) {
  return responses.sort((first, second) => {
    const timeDifference = Date.parse(second.created_at) - Date.parse(first.created_at)
    return timeDifference || second.id.localeCompare(first.id)
  })
}

export async function getSessionResponses(
  sessionId: string,
  pulseId?: string,
) {
  const supabase = getTeacherSupabase()

  if (pulseId) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('session_id', sessionId)
      .eq('pulse_id', pulseId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(maximumPulseResponses)

    if (error) throw error
    return sortNewestFirst((data ?? []) as StudentResponse[])
  }

  const byId = new Map<string, StudentResponse>()
  for (let offset = 0; offset < maximumSessionResponses; offset += responsePageSize) {
    const lastIndex = Math.min(
      offset + responsePageSize - 1,
      maximumSessionResponses - 1,
    )
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, lastIndex)

    if (error) throw error

    const page = (data ?? []) as StudentResponse[]
    page.forEach((response) => byId.set(response.id, response))
    if (page.length < lastIndex - offset + 1) break
  }

  return sortNewestFirst(Array.from(byId.values()))
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
  const parsedDraft = responseDraftSchema.safeParse(values)
  if (!parsedDraft.success) {
    throw new ResponseSubmissionError(
      'La respuesta enviada no es valida.',
      'invalid_submission',
    )
  }

  const { data, error } = await getPublicSupabase().functions.invoke(
    'submit-response',
    { body: {
      sessionId: parsedDraft.data.sessionId,
      pulseId: parsedDraft.data.pulseId,
      anonymousId: parsedDraft.data.anonymousId,
      status: parsedDraft.data.status,
      questionText: parsedDraft.data.questionText || null,
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
  pulseId?: string,
) {
  return getTeacherSupabase()
    .channel(`responses:${sessionId}:${pulseId ?? 'all'}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'responses',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const response = payload.new as StudentResponse
        if (response.session_id !== sessionId) return
        if (pulseId && response.pulse_id !== pulseId) return
        onInsert(response)
      },
    )
    .subscribe((status) => onStatus(status))
}

export async function unsubscribeFromResponses(channel: RealtimeChannel) {
  await getTeacherSupabase().removeChannel(channel)
}
