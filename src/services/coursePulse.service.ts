import { coursePulseHistorySchema } from '../schemas/coursePulse'
import type {
  CoursePulsePoint,
  UnderstandingStatus,
} from '../types/domain'
import { getTeacherSupabase } from './supabase'

export const defaultCoursePulseLimit = 8
export const maximumCoursePulseLimit = 24
const responsePageSize = 1000

interface PulseResponseRow {
  id: string
  session_id: string
  status: UnderstandingStatus
}

function isMissingCoursePulseRpc(error: unknown) {
  if (typeof error !== 'object' || error === null) return false

  const candidate = error as { code?: unknown; message?: unknown }
  const code = String(candidate.code ?? '')
  const message = String(candidate.message ?? '').toLowerCase()

  return code === 'PGRST202'
    || (
      message.includes('get_course_pulse_history')
      && (
        message.includes('could not find')
        || message.includes('schema cache')
        || message.includes('does not exist')
      )
    )
}

async function getCompatibilityCoursePulseHistory(
  courseId: string,
  limit: number,
) {
  const supabase = getTeacherSupabase()
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, title, created_at, is_active')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (sessionsError) throw sessionsError
  if (!sessions?.length) return []

  const sessionIds = sessions.map((session) => String(session.id))
  const responses: PulseResponseRow[] = []

  for (let offset = 0; ;) {
    const { data, error } = await supabase
      .from('responses')
      .select('id, session_id, status')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + responsePageSize - 1)

    if (error) throw error

    const page = (data ?? []) as PulseResponseRow[]
    if (page.length === 0) break

    responses.push(...page)
    offset += page.length
  }

  const counts = new Map<string, Record<UnderstandingStatus, number>>(
    sessionIds.map((sessionId) => [
      sessionId,
      { understood: 0, question: 0, lost: 0 },
    ]),
  )

  for (const response of responses) {
    const sessionCounts = counts.get(response.session_id)
    if (sessionCounts && response.status in sessionCounts) {
      sessionCounts[response.status] += 1
    }
  }

  return sessions
    .map((session) => {
      const sessionCounts = counts.get(String(session.id))
        ?? { understood: 0, question: 0, lost: 0 }

      return {
        session_id: String(session.id),
        title: String(session.title),
        created_at: String(session.created_at),
        is_active: Boolean(session.is_active),
        response_count:
          sessionCounts.understood
          + sessionCounts.question
          + sessionCounts.lost,
        understood_count: sessionCounts.understood,
        question_count: sessionCounts.question,
        lost_count: sessionCounts.lost,
      }
    })
    .reverse()
}

export async function getCoursePulseHistory(
  courseId: string,
  limit = defaultCoursePulseLimit,
) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.trunc(limit)
    : defaultCoursePulseLimit
  const boundedLimit = Math.min(
    Math.max(normalizedLimit, 1),
    maximumCoursePulseLimit,
  )
  const { data, error } = await getTeacherSupabase().rpc(
    'get_course_pulse_history',
    {
      p_course_id: courseId,
      p_limit: boundedLimit,
    },
  )

  if (error && !isMissingCoursePulseRpc(error)) throw error

  const pulseData = error
    ? await getCompatibilityCoursePulseHistory(courseId, boundedLimit)
    : data ?? []
  const parsed = coursePulseHistorySchema.safeParse(pulseData)
  if (!parsed.success) {
    throw new Error('El historial del curso tiene un formato inesperado.')
  }

  return parsed.data as CoursePulsePoint[]
}
