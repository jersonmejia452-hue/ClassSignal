import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  channelMock,
  fromMock,
  publicInvokeMock,
  removeChannelMock,
} = vi.hoisted(() => ({
  channelMock: vi.fn(),
  fromMock: vi.fn(),
  publicInvokeMock: vi.fn(),
  removeChannelMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getPublicSupabase: () => ({
    functions: { invoke: publicInvokeMock },
  }),
  getTeacherSupabase: () => ({
    channel: channelMock,
    from: fromMock,
    removeChannel: removeChannelMock,
  }),
}))

import {
  getSessionResponses,
  submitStudentResponse,
  subscribeToSessionResponses,
} from './responses.service'
import type { StudentResponse } from '../types/domain'

const sessionId = '00000000-0000-4000-8000-000000000001'
const pulseId = '00000000-0000-4000-8000-000000000002'
const anonymousId = '00000000-0000-4000-8000-000000000003'

function response(index: number, responsePulseId = pulseId): StudentResponse {
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    session_id: sessionId,
    pulse_id: responsePulseId,
    anonymous_id: `10000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    status: 'understood',
    question_text: null,
    is_visible_to_students: true,
    created_at: new Date(Date.UTC(2026, 6, 18, 23, 0, index % 60)).toISOString(),
  }
}

function responseQuery(result: { data: StudentResponse[]; error: unknown }) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit']) {
    query[method] = vi.fn(() => query)
  }
  query.range = vi.fn().mockResolvedValue(result)
  Object.assign(query, result)
  return query as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
    data: StudentResponse[]
    error: unknown
  }
}

describe('responses.service pulse contracts', () => {
  beforeEach(() => {
    channelMock.mockReset()
    fromMock.mockReset()
    publicInvokeMock.mockReset()
    removeChannelMock.mockReset()
  })

  it('limita una consulta de pulso a 500 filas', async () => {
    const query = responseQuery({ data: [response(1)], error: null })
    fromMock.mockReturnValue(query)

    await expect(getSessionResponses(sessionId, pulseId)).resolves.toHaveLength(1)
    expect(query.eq).toHaveBeenNthCalledWith(1, 'session_id', sessionId)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'pulse_id', pulseId)
    expect(query.limit).toHaveBeenCalledWith(500)
  })

  it('pagina, deduplica y ordena hasta 3.000 respuestas de la clase', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => response(index + 1))
    const secondPage = [firstPage[999]!, response(1001)]
    const firstQuery = responseQuery({ data: firstPage, error: null })
    const secondQuery = responseQuery({ data: secondPage, error: null })
    fromMock.mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery)

    const responses = await getSessionResponses(sessionId)

    expect(responses).toHaveLength(1001)
    expect(firstQuery.range).toHaveBeenCalledWith(0, 999)
    expect(secondQuery.range).toHaveBeenCalledWith(1000, 1999)
    expect(new Set(responses.map((item) => item.id)).size).toBe(1001)
  })

  it('incluye pulseId en el body seguro enviado a la Edge Function', async () => {
    publicInvokeMock.mockResolvedValue({ data: { accepted: true }, error: null })

    await submitStudentResponse({
      sessionId,
      pulseId,
      anonymousId,
      status: 'question',
      questionText: '  No entiendo este paso.  ',
    }, 'turnstile-token')

    expect(publicInvokeMock).toHaveBeenCalledWith('submit-response', {
      body: {
        sessionId,
        pulseId,
        anonymousId,
        status: 'question',
        questionText: 'No entiendo este paso.',
        turnstileToken: 'turnstile-token',
      },
    })
  })

  it('descarta eventos Realtime de otra ronda cuando hay filtro local', () => {
    let insertHandler: ((payload: { new: StudentResponse }) => void) | undefined
    const subscribe = vi.fn()
    const on = vi.fn((_: string, __: unknown, handler: typeof insertHandler) => {
      insertHandler = handler
      return { subscribe }
    })
    channelMock.mockReturnValue({ on })
    const onInsert = vi.fn()

    subscribeToSessionResponses(sessionId, onInsert, vi.fn(), pulseId)
    insertHandler?.({ new: response(1, '00000000-0000-4000-8000-000000000099') })
    insertHandler?.({ new: response(2) })

    expect(onInsert).toHaveBeenCalledOnce()
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ pulse_id: pulseId }))
  })
})
