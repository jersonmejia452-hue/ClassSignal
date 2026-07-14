import { getErrorCode } from '../lib/errors'
import type {
  ClassSession,
  PublicClassSession,
  SessionDraft,
} from '../types/domain'
import { getPublicSupabase, getTeacherSupabase } from './supabase'

const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateSessionCode(length = 6) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => codeAlphabet.charAt(byte % codeAlphabet.length)).join(
    '',
  )
}

export async function getMySessions(professorId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('sessions')
    .select('*')
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ClassSession[]
}

export async function getSessionById(sessionId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) throw error
  return data as ClassSession | null
}

export async function getSessionsByCourse(courseId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('sessions')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ClassSession[]
}

export async function createSession(
  professorId: string,
  values: SessionDraft,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await getTeacherSupabase()
      .from('sessions')
      .insert({
        professor_id: professorId,
        course_id: values.courseId ?? null,
        code: generateSessionCode(),
        title: values.title,
        subject: values.subject,
        topic: values.topic,
      })
      .select('*')
      .single()

    if (!error) return data as ClassSession
    if (getErrorCode(error) !== '23505') throw error
  }

  throw new Error('No pudimos generar un código único. Intenta nuevamente.')
}

export async function setSessionActive(sessionId: string, isActive: boolean) {
  const { data, error } = await getTeacherSupabase()
    .from('sessions')
    .update({
      is_active: isActive,
      ended_at: isActive ? null : new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) throw error
  return data as ClassSession
}

export async function getPublicSession(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  const { data, error } = await getPublicSupabase()
    .rpc('get_public_session', { p_code: normalizedCode })
    .maybeSingle()

  if (error) throw error
  return data as PublicClassSession | null
}
