import { z } from 'zod'

import { classPublicationSchema } from '../schemas/classPublication'
import type {
  SessionPublication,
  SessionPublicationDraft,
} from '../types/domain'
import { getAccountSupabase } from './supabase'

const publicationSchema = z.object({
  session_id: z.string().uuid(),
  summary: z.string(),
  resources: z.string().nullable(),
  questions_published: z.boolean(),
  published_at: z.string(),
  updated_at: z.string(),
}).strict()

function parsePublication(data: unknown) {
  const parsed = publicationSchema.safeParse(data)
  if (!parsed.success) throw new Error('invalid_publication_payload')
  return parsed.data as SessionPublication
}

export async function getSessionPublication(sessionId: string) {
  const { data, error } = await getAccountSupabase()
    .from('session_publications')
    .select('session_id, summary, resources, questions_published, published_at, updated_at')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) throw error
  return data ? parsePublication(data) : null
}

export async function saveSessionPublication(
  sessionId: string,
  values: SessionPublicationDraft,
) {
  const parsedValues = classPublicationSchema.safeParse({
    summary: values.summary,
    resources: values.resources ?? '',
    questions_published: values.questions_published,
  })
  if (!parsedValues.success) throw new Error('invalid_publication')

  const { data, error } = await getAccountSupabase()
    .rpc('save_session_publication', {
      p_session_id: sessionId,
      p_summary: parsedValues.data.summary,
      p_resources: parsedValues.data.resources,
      p_questions_published: parsedValues.data.questions_published,
    })
    .single()

  if (error) throw error
  return parsePublication(data)
}

export async function deleteSessionPublication(sessionId: string) {
  const { error } = await getAccountSupabase()
    .from('session_publications')
    .delete()
    .eq('session_id', sessionId)

  if (error) throw error
}

export async function getCourseEnrollmentCount(courseId: string) {
  const { data, error } = await getAccountSupabase().rpc(
    'get_course_enrollment_count',
    { p_course_id: courseId },
  )

  if (error) throw error
  const parsed = z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).safeParse(data)
  if (!parsed.success) throw new Error('invalid_enrollment_count')
  return parsed.data
}
