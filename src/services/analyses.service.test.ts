import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, invokeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  invokeMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getTeacherSupabase: () => ({
    from: fromMock,
    functions: { invoke: invokeMock },
  }),
}))

import { analyzeSession, getSessionAnalyses } from './analyses.service'

const sessionId = '00000000-0000-4000-8000-000000000001'
const pulseId = '00000000-0000-4000-8000-000000000002'

const analysis = {
  id: '00000000-0000-4000-8000-000000000003',
  session_id: sessionId,
  pulse_id: pulseId,
  professor_id: '00000000-0000-4000-8000-000000000004',
  status: 'completed',
  model: 'gpt-5.6-luna',
  prompt_version: 1,
  response_count: 1,
  source_latest_response_at: '2026-07-18T23:00:00.000Z',
  result: {
    overview: 'Resumen',
    confusion_level: 'low',
    concepts: [],
    recommendations: [],
  },
  error_message: null,
  input_tokens: 10,
  cached_input_tokens: 0,
  output_tokens: 5,
  reasoning_tokens: 0,
  total_tokens: 15,
  estimated_cost_usd: 0.0001,
  pricing_version: 'test',
  duration_ms: 100,
  provider_request_id: null,
  provider_response_id: null,
  created_at: '2026-07-18T23:00:00.000Z',
  completed_at: '2026-07-18T23:00:01.000Z',
}

describe('analyses.service pulse contracts', () => {
  beforeEach(() => {
    fromMock.mockReset()
    invokeMock.mockReset()
  })

  it('filtra el historial por sesión y pulso', async () => {
    const query: Record<string, unknown> = { data: [analysis], error: null }
    for (const method of ['select', 'eq', 'order', 'limit']) {
      query[method] = vi.fn(() => query)
    }
    fromMock.mockReturnValue(query)

    await expect(getSessionAnalyses(sessionId, pulseId)).resolves.toHaveLength(1)
    expect(query.eq).toHaveBeenNthCalledWith(1, 'session_id', sessionId)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'pulse_id', pulseId)
  })

  it('invoca el análisis con los dos identificadores', async () => {
    invokeMock.mockResolvedValue({
      data: { analysis, cached: false },
      error: null,
    })

    await expect(analyzeSession(sessionId, pulseId)).resolves.toMatchObject({
      analysis: { pulse_id: pulseId },
      cached: false,
    })
    expect(invokeMock).toHaveBeenCalledWith('analyze-session', {
      body: { sessionId, pulseId },
    })
  })
})
