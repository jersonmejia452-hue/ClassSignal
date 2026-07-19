import type { RealtimeChannel } from '@supabase/supabase-js'

import { sessionPulseListSchema, sessionPulseSchema } from '../schemas/pulse'
import type { SessionPulse } from '../types/domain'
import { getTeacherSupabase } from './supabase'

export async function getSessionPulses(sessionId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('session_pulses')
    .select('*')
    .eq('session_id', sessionId)
    .order('ordinal', { ascending: true })

  if (error) throw error

  const parsed = sessionPulseListSchema.safeParse(data ?? [])
  if (!parsed.success) {
    throw new Error('Los pulsos de la clase tienen un formato inesperado.')
  }

  return parsed.data as SessionPulse[]
}

export async function openNextSessionPulse(sessionId: string) {
  const { data, error } = await getTeacherSupabase().rpc(
    'open_next_session_pulse',
    { p_session_id: sessionId },
  )

  if (error) throw error

  const parsed = sessionPulseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error('El servidor devolvió un pulso inesperado.')
  }

  return parsed.data as SessionPulse
}

export async function setPulseQuestionsVisible(
  pulseId: string,
  questionsVisibleToStudents: boolean,
) {
  const { data, error } = await getTeacherSupabase()
    .from('session_pulses')
    .update({ questions_visible_to_students: questionsVisibleToStudents })
    .eq('id', pulseId)
    .select('*')
    .single()

  if (error) throw error

  const parsed = sessionPulseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error('El servidor devolvió un pulso inesperado.')
  }

  return parsed.data as SessionPulse
}

export function subscribeToSessionPulses(
  sessionId: string,
  onChange: () => void,
  onStatus: (status: string) => void,
) {
  return getTeacherSupabase()
    .channel(`session-pulses:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_pulses',
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .subscribe((status) => onStatus(status))
}

export async function unsubscribeFromSessionPulses(channel: RealtimeChannel) {
  await getTeacherSupabase().removeChannel(channel)
}
