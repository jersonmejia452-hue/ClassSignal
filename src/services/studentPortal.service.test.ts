import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAccountSupabaseMock, rpcMock } = vi.hoisted(() => ({
  getAccountSupabaseMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getAccountSupabase: getAccountSupabaseMock,
}))

import {
  enrollInCourse,
  getStudentCourseDetails,
  getStudentSessionArchive,
  listMyStudentCourses,
  listStudentArchiveQuestions,
  listStudentCourseSessions,
} from './studentPortal.service'

const courseId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const responseId = '00000000-0000-4000-8000-000000000003'

const studentCourse = {
  course_id: courseId,
  name: 'Cálculo I',
  subject: 'Matemáticas',
  description: 'Límites y derivadas',
  joined_at: '2026-07-19T01:00:00.000Z',
  session_count: '3',
  active_session_count: '1',
  latest_session_at: '2026-07-19T02:00:00.000Z',
}

const studentSession = {
  session_id: sessionId,
  code: 'AULA24',
  title: 'Regla de la cadena',
  subject: 'Cálculo',
  topic: 'Derivadas compuestas',
  is_active: false,
  created_at: '2026-07-19T02:00:00.000Z',
  ended_at: '2026-07-19T03:00:00.000Z',
  has_publication: true,
  questions_published: true,
}

const archive = {
  session_id: sessionId,
  course_id: courseId,
  course_name: 'Cálculo I',
  code: 'AULA24',
  title: 'Regla de la cadena',
  subject: 'Cálculo',
  topic: 'Derivadas compuestas',
  is_active: false,
  created_at: '2026-07-19T02:00:00.000Z',
  ended_at: '2026-07-19T03:00:00.000Z',
  summary: 'Aplicamos la regla de la cadena a funciones compuestas.',
  resources: 'Capítulo 3',
  questions_published: true,
  published_at: '2026-07-19T04:00:00.000Z',
}

function mockMaybeSingle(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  rpcMock.mockReturnValue({ maybeSingle })
  return maybeSingle
}

describe('studentPortal.service', () => {
  beforeEach(() => {
    getAccountSupabaseMock.mockReset()
    rpcMock.mockReset()
    getAccountSupabaseMock.mockReturnValue({ rpc: rpcMock })
  })

  it('normaliza el código y matricula mediante la RPC autenticada exacta', async () => {
    const maybeSingle = mockMaybeSingle({
      data: { course_id: courseId, enrollment_status: 'joined' },
      error: null,
    })

    await expect(enrollInCourse('  abcd2345  ')).resolves.toEqual({
      course_id: courseId,
      enrollment_status: 'joined',
    })
    expect(getAccountSupabaseMock).toHaveBeenCalledOnce()
    expect(rpcMock).toHaveBeenCalledWith('enroll_in_course', {
      p_code: 'ABCD2345',
    })
    expect(maybeSingle).toHaveBeenCalledOnce()
  })

  it('convierte el resultado no disponible en un error público estable', async () => {
    mockMaybeSingle({
      data: { course_id: null, enrollment_status: 'course_unavailable' },
      error: null,
    })

    await expect(enrollInCourse('ABCD2345')).rejects.toThrow(
      'course_enrollment_unavailable',
    )
  })

  it('lista cursos, convierte conteos y rechaza campos privados', async () => {
    rpcMock.mockResolvedValueOnce({ data: [studentCourse], error: null })

    await expect(listMyStudentCourses()).resolves.toEqual([{
      ...studentCourse,
      session_count: 3,
      active_session_count: 1,
    }])
    expect(rpcMock).toHaveBeenCalledWith('get_my_student_courses')

    rpcMock.mockResolvedValueOnce({
      data: [{ ...studentCourse, professor_id: responseId }],
      error: null,
    })
    await expect(listMyStudentCourses()).rejects.toThrow(
      'invalid_portal_payload',
    )
  })

  it('devuelve null para un curso no matriculado y conserva sus parámetros', async () => {
    mockMaybeSingle({ data: null, error: null })

    await expect(getStudentCourseDetails(courseId)).resolves.toBeNull()
    expect(rpcMock).toHaveBeenCalledWith('get_student_course_details', {
      p_course_id: courseId,
    })
  })

  it('lista únicamente las clases devueltas por la RPC del curso', async () => {
    rpcMock.mockResolvedValue({ data: [studentSession], error: null })

    await expect(listStudentCourseSessions(courseId)).resolves.toEqual([
      studentSession,
    ])
    expect(rpcMock).toHaveBeenCalledWith('get_student_course_sessions', {
      p_course_id: courseId,
    })
  })

  it('valida de forma estricta el archivo de una clase', async () => {
    mockMaybeSingle({ data: archive, error: null })

    await expect(getStudentSessionArchive(sessionId)).resolves.toEqual(archive)
    expect(rpcMock).toHaveBeenCalledWith('get_student_session_archive', {
      p_session_id: sessionId,
    })

    mockMaybeSingle({ data: { ...archive, anonymous_id: responseId }, error: null })
    await expect(getStudentSessionArchive(sessionId)).rejects.toThrow(
      'invalid_portal_payload',
    )
  })

  it('consulta el muro archivado con una proyección estricta', async () => {
    const question = {
      response_id: responseId,
      pulse_ordinal: 2,
      question_text: '¿Por qué se multiplican las derivadas?',
    }
    rpcMock.mockResolvedValueOnce({ data: [question], error: null })

    await expect(listStudentArchiveQuestions(sessionId)).resolves.toEqual([
      question,
    ])
    expect(rpcMock).toHaveBeenCalledWith('get_student_archive_questions', {
      p_session_id: sessionId,
    })

    rpcMock.mockResolvedValueOnce({
      data: [{ ...question, status: 'lost' }],
      error: null,
    })
    await expect(listStudentArchiveQuestions(sessionId)).rejects.toThrow(
      'invalid_portal_payload',
    )
  })
})
