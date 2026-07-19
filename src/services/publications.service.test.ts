import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, getAccountSupabaseMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getAccountSupabaseMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getAccountSupabase: getAccountSupabaseMock,
}))

import {
  deleteSessionPublication,
  getCourseEnrollmentCount,
  getSessionPublication,
  saveSessionPublication,
} from './publications.service'

const courseId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const publication = {
  session_id: sessionId,
  summary: 'Resumen publicado de la clase.',
  resources: 'Capítulo 3',
  questions_published: true,
  published_at: '2026-07-19T04:00:00.000Z',
  updated_at: '2026-07-19T04:00:00.000Z',
}
const publicationColumns =
  'session_id, summary, resources, questions_published, published_at, updated_at'

describe('publications.service', () => {
  beforeEach(() => {
    fromMock.mockReset()
    getAccountSupabaseMock.mockReset()
    rpcMock.mockReset()
    getAccountSupabaseMock.mockReturnValue({ from: fromMock, rpc: rpcMock })
  })

  it('consulta una publicación con proyección mínima y cliente autenticado', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: publication, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    fromMock.mockReturnValue({ select })

    await expect(getSessionPublication(sessionId)).resolves.toEqual(publication)
    expect(getAccountSupabaseMock).toHaveBeenCalledOnce()
    expect(fromMock).toHaveBeenCalledWith('session_publications')
    expect(select).toHaveBeenCalledWith(publicationColumns)
    expect(eq).toHaveBeenCalledWith('session_id', sessionId)
  })

  it('devuelve null cuando todavía no existe publicación', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    fromMock.mockReturnValue({ select })

    await expect(getSessionPublication(sessionId)).resolves.toBeNull()
  })

  it('rechaza payloads publicados con campos privados inesperados', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { ...publication, professor_id: courseId },
      error: null,
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    fromMock.mockReturnValue({ select })

    await expect(getSessionPublication(sessionId)).rejects.toThrow(
      'invalid_publication_payload',
    )
  })

  it('normaliza y guarda la publicación por session_id', async () => {
    const single = vi.fn().mockResolvedValue({ data: publication, error: null })
    rpcMock.mockReturnValue({ single })

    await expect(saveSessionPublication(sessionId, {
      summary: '  Resumen publicado de la clase.  ',
      resources: '  Capítulo 3  ',
      questions_published: true,
    })).resolves.toEqual(publication)
    expect(rpcMock).toHaveBeenCalledWith('save_session_publication', {
      p_session_id: sessionId,
      p_summary: 'Resumen publicado de la clase.',
      p_resources: 'Capítulo 3',
      p_questions_published: true,
    })
    expect(single).toHaveBeenCalledOnce()
  })

  it('elimina únicamente la publicación de la clase indicada', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const deleteMock = vi.fn(() => ({ eq }))
    fromMock.mockReturnValue({ delete: deleteMock })

    await expect(deleteSessionPublication(sessionId)).resolves.toBeUndefined()
    expect(deleteMock).toHaveBeenCalledOnce()
    expect(eq).toHaveBeenCalledWith('session_id', sessionId)
  })

  it('consulta y valida el conteo agregado de matrículas', async () => {
    rpcMock.mockResolvedValueOnce({ data: '24', error: null })

    await expect(getCourseEnrollmentCount(courseId)).resolves.toBe(24)
    expect(rpcMock).toHaveBeenCalledWith('get_course_enrollment_count', {
      p_course_id: courseId,
    })

    rpcMock.mockResolvedValueOnce({ data: -1, error: null })
    await expect(getCourseEnrollmentCount(courseId)).rejects.toThrow(
      'invalid_enrollment_count',
    )
  })
})
