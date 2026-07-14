import type { RealtimeChannel } from '@supabase/supabase-js'

import type { ResponseDraft, StudentResponse } from '../types/domain'
import { getPublicSupabase, getTeacherSupabase } from './supabase'

export async function getSessionResponses(sessionId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('responses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as StudentResponse[]
}

export async function submitStudentResponse(values: ResponseDraft) {
  const { error } = await getPublicSupabase().from('responses').insert({
    session_id: values.sessionId,
    anonymous_id: values.anonymousId,
    status: values.status,
    question_text: values.questionText?.trim() || null,
  })

  if (error) throw error
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
