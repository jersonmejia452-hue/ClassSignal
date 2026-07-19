import { z } from 'zod'

import type {
  EnrollmentResult,
  StudentArchiveQuestion,
  StudentCourse,
  StudentCourseDetails,
  StudentCourseSession,
  StudentSessionArchive,
} from '../types/domain'
import { getAccountSupabase } from './supabase'

const nullableText = z.string().nullable()
const timestamp = z.string().min(1)
const nonNegativeCount = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/).transform(Number),
])

const enrollmentResultSchema = z.union([
  z.object({
    course_id: z.string().uuid(),
    enrollment_status: z.enum(['joined', 'already_enrolled']),
  }).strict(),
  z.object({
    course_id: z.null(),
    enrollment_status: z.literal('course_unavailable'),
  }).strict(),
])

const studentCourseSchema = z.object({
  course_id: z.string().uuid(),
  name: z.string(),
  subject: z.string(),
  description: nullableText,
  joined_at: timestamp,
  session_count: nonNegativeCount,
  active_session_count: nonNegativeCount,
  latest_session_at: timestamp.nullable(),
}).strict()

const studentCourseDetailsSchema = studentCourseSchema.pick({
  course_id: true,
  name: true,
  subject: true,
  description: true,
  joined_at: true,
}).strict()

const studentCourseSessionSchema = z.object({
  session_id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  subject: z.string(),
  topic: z.string(),
  is_active: z.boolean(),
  created_at: timestamp,
  ended_at: timestamp.nullable(),
  has_publication: z.boolean(),
  questions_published: z.boolean(),
}).strict()

const studentSessionArchiveSchema = z.object({
  session_id: z.string().uuid(),
  course_id: z.string().uuid(),
  course_name: z.string(),
  code: z.string(),
  title: z.string(),
  subject: z.string(),
  topic: z.string(),
  is_active: z.boolean(),
  created_at: timestamp,
  ended_at: timestamp.nullable(),
  summary: nullableText,
  resources: nullableText,
  questions_published: z.boolean(),
  published_at: timestamp.nullable(),
}).strict()

const studentArchiveQuestionSchema = z.object({
  response_id: z.string().uuid(),
  pulse_ordinal: z.number().int().positive(),
  question_text: z.string().min(1).max(1000),
}).strict()

function parseList<T>(schema: z.ZodType<T>, data: unknown, errorCode: string) {
  const result = z.array(schema).safeParse(data ?? [])
  if (!result.success) throw new Error(errorCode)
  return result.data
}

export async function enrollInCourse(code: string): Promise<EnrollmentResult> {
  const { data, error } = await getAccountSupabase()
    .rpc('enroll_in_course', { p_code: code.trim().toUpperCase() })
    .maybeSingle()

  if (error) throw error
  const parsed = enrollmentResultSchema.safeParse(data)
  if (!parsed.success) throw new Error('invalid_portal_payload')
  if (parsed.data.enrollment_status === 'course_unavailable') {
    throw new Error('course_enrollment_unavailable')
  }
  return parsed.data
}

export async function listMyStudentCourses(): Promise<StudentCourse[]> {
  const { data, error } = await getAccountSupabase()
    .rpc('get_my_student_courses')

  if (error) throw error
  return parseList(studentCourseSchema, data, 'invalid_portal_payload')
}

export async function getStudentCourseDetails(
  courseId: string,
): Promise<StudentCourseDetails | null> {
  const { data, error } = await getAccountSupabase()
    .rpc('get_student_course_details', { p_course_id: courseId })
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const parsed = studentCourseDetailsSchema.safeParse(data)
  if (!parsed.success) throw new Error('invalid_portal_payload')
  return parsed.data
}

export async function listStudentCourseSessions(
  courseId: string,
): Promise<StudentCourseSession[]> {
  const { data, error } = await getAccountSupabase().rpc(
    'get_student_course_sessions',
    { p_course_id: courseId },
  )

  if (error) throw error
  return parseList(studentCourseSessionSchema, data, 'invalid_portal_payload')
}

export async function getStudentSessionArchive(
  sessionId: string,
): Promise<StudentSessionArchive | null> {
  const { data, error } = await getAccountSupabase()
    .rpc('get_student_session_archive', { p_session_id: sessionId })
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const parsed = studentSessionArchiveSchema.safeParse(data)
  if (!parsed.success) throw new Error('invalid_portal_payload')
  return parsed.data
}

export async function listStudentArchiveQuestions(
  sessionId: string,
): Promise<StudentArchiveQuestion[]> {
  const { data, error } = await getAccountSupabase().rpc(
    'get_student_archive_questions',
    { p_session_id: sessionId },
  )

  if (error) throw error
  return parseList(studentArchiveQuestionSchema, data, 'invalid_portal_payload')
}
