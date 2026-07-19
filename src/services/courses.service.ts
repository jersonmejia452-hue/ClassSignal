import type { Course, CourseDraft } from '../types/domain'
import { getTeacherSupabase } from './supabase'

function normalizeDescription(description: string | null | undefined) {
  const normalized = description?.trim()
  return normalized ? normalized : null
}

export async function getMyCourses(professorId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('courses')
    .select('*')
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Course[]
}

export async function getCourseById(courseId: string) {
  const { data, error } = await getTeacherSupabase()
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (error) throw error
  return data as Course | null
}

export async function createCourse(
  professorId: string,
  values: CourseDraft,
) {
  const { data, error } = await getTeacherSupabase()
    .from('courses')
    .insert({
      professor_id: professorId,
      name: values.name.trim(),
      subject: values.subject.trim(),
      description: normalizeDescription(values.description),
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Course
}

export async function updateCourse(
  courseId: string,
  values: CourseDraft,
) {
  const { data, error } = await getTeacherSupabase()
    .from('courses')
    .update({
      name: values.name.trim(),
      subject: values.subject.trim(),
      description: normalizeDescription(values.description),
    })
    .eq('id', courseId)
    .select('*')
    .single()

  if (error) throw error
  return data as Course
}

export async function setCourseEnrollmentOpen(
  courseId: string,
  enrollmentOpen: boolean,
) {
  const { data, error } = await getTeacherSupabase()
    .from('courses')
    .update({ enrollment_open: enrollmentOpen })
    .eq('id', courseId)
    .select('*')
    .single()

  if (error) throw error
  return data as Course
}

export async function deleteCourse(courseId: string) {
  const { error } = await getTeacherSupabase()
    .from('courses')
    .delete()
    .eq('id', courseId)

  if (error) throw error
}
