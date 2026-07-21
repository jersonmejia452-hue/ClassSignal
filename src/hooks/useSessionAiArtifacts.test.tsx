// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionAiArtifactPendingTimeoutMs } from '../types/domain'

const {
  generateSessionAiArtifactMock,
  getSessionAiArtifactsMock,
} = vi.hoisted(() => ({
  generateSessionAiArtifactMock: vi.fn(),
  getSessionAiArtifactsMock: vi.fn(),
}))

vi.mock('../services/sessionAiArtifacts.service', () => ({
  generateSessionAiArtifact: generateSessionAiArtifactMock,
  getSessionAiArtifacts: getSessionAiArtifactsMock,
}))

import { useSessionAiArtifacts } from './useSessionAiArtifacts'

const sessionId = '00000000-0000-4000-8000-000000000021'

function pendingArtifact(createdAt: string) {
  return {
    id: '00000000-0000-4000-8000-000000000022',
    professor_id: '00000000-0000-4000-8000-000000000023',
    session_id: sessionId,
    pulse_id: null,
    source_analysis_id: null,
    concept_index: null,
    kind: 'publication_draft' as const,
    status: 'pending' as const,
    model: 'gpt-5.6-luna',
    reasoning_effort: 'high' as const,
    prompt_version: 1,
    source_fingerprint: 'c'.repeat(64),
    source_captured_at: createdAt,
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
    created_at: createdAt,
    completed_at: null,
  }
}

beforeEach(() => {
  generateSessionAiArtifactMock.mockReset()
  getSessionAiArtifactsMock.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useSessionAiArtifacts', () => {
  it('deja de indicar progreso al vencer aunque falle la consulta final', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-21T15:00:00.000Z'))
    const remainingMs = 25
    const createdAt = new Date(
      Date.now() - sessionAiArtifactPendingTimeoutMs + remainingMs,
    ).toISOString()
    getSessionAiArtifactsMock
      .mockResolvedValueOnce([pendingArtifact(createdAt)])
      .mockRejectedValueOnce(new Error('network_unavailable'))

    const { result } = renderHook(() => (
      useSessionAiArtifacts(sessionId, 'publication_draft')
    ))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.inProgress).toBe(true)
    expect(result.current.hasTimedOutPending).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(remainingMs)
    })

    expect(getSessionAiArtifactsMock).toHaveBeenCalledTimes(2)
    expect(result.current.inProgress).toBe(false)
    expect(result.current.hasTimedOutPending).toBe(true)
  })

  it('limpia un error de carga después de una actualización correcta', async () => {
    getSessionAiArtifactsMock
      .mockRejectedValueOnce(new Error('network_unavailable'))
      .mockResolvedValueOnce([])

    const { result } = renderHook(() => (
      useSessionAiArtifacts(sessionId, 'publication_draft')
    ))

    await waitFor(() => expect(result.current.error).toBeTruthy())

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.inProgress).toBe(false)
  })
})
