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

import {
  generateSessionAiArtifact,
  getSessionAiArtifacts,
  SessionAiArtifactInvocationError,
} from './sessionAiArtifacts.service'

const sessionId = '00000000-0000-4000-8000-000000000001'
const pulseId = '00000000-0000-4000-8000-000000000002'
const pendingArtifact = {
  id: '00000000-0000-4000-8000-000000000003',
  professor_id: '00000000-0000-4000-8000-000000000004',
  session_id: sessionId,
  pulse_id: pulseId,
  source_analysis_id: '00000000-0000-4000-8000-000000000005',
  concept_index: 0,
  kind: 'micro_intervention',
  status: 'pending',
  model: 'gpt-5.6-luna',
  reasoning_effort: 'high',
  prompt_version: 1,
  source_fingerprint: 'b'.repeat(64),
  source_captured_at: '2026-07-21T14:59:55.000Z',
  result: null,
  error_code: null,
  error_message: null,
  input_tokens: null,
  cached_input_tokens: null,
  output_tokens: null,
  reasoning_tokens: null,
  total_tokens: null,
  estimated_cost_usd: null,
  pricing_version: null,
  duration_ms: null,
  provider_request_id: null,
  provider_response_id: null,
  created_at: '2026-07-21T15:00:00.000Z',
  completed_at: null,
}

describe('sessionAiArtifacts.service', () => {
  beforeEach(() => {
    fromMock.mockReset()
    invokeMock.mockReset()
  })

  it('lista el historial acotado por sesión y tipo', async () => {
    const query: Record<string, unknown> = { data: [pendingArtifact], error: null }
    for (const method of ['select', 'eq', 'order', 'limit']) {
      query[method] = vi.fn(() => query)
    }
    fromMock.mockReturnValue(query)

    await expect(
      getSessionAiArtifacts(sessionId, 'micro_intervention'),
    ).resolves.toEqual([pendingArtifact])
    expect(query.eq).toHaveBeenNthCalledWith(1, 'session_id', sessionId)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'kind', 'micro_intervention')
    expect(query.limit).toHaveBeenCalledWith(100)
  })

  it('invoca la función con entrada discriminada y regeneración explícita', async () => {
    invokeMock.mockResolvedValue({
      data: { artifact: pendingArtifact, cached: false, in_progress: true },
      error: null,
    })

    await expect(generateSessionAiArtifact({
      sessionId,
      kind: 'micro_intervention',
      pulseId,
      conceptIndex: 0,
      regenerate: true,
    })).resolves.toMatchObject({ cached: false, in_progress: true })
    expect(invokeMock).toHaveBeenCalledWith('generate-session-artifact', {
      body: {
        sessionId,
        kind: 'micro_intervention',
        pulseId,
        conceptIndex: 0,
        regenerate: true,
      },
    })
  })

  it('rechaza localmente una solicitud incompleta', async () => {
    await expect(generateSessionAiArtifact({
      sessionId,
      kind: 'micro_intervention',
    } as never)).rejects.toBeInstanceOf(SessionAiArtifactInvocationError)
    expect(invokeMock).not.toHaveBeenCalled()
  })
})
