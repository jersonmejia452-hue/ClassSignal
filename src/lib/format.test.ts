import { describe, expect, it } from 'vitest'

import {
  buildStatusSummary,
  formatDuration,
  formatEstimatedUsd,
} from './format'
import type { StudentResponse, UnderstandingStatus } from '../types/domain'

function response(status: UnderstandingStatus, index: number): StudentResponse {
  return {
    id: `response-${index}`,
    session_id: 'session-1',
    anonymous_id: `anonymous-${index}`,
    status,
    question_text: null,
    is_visible_to_students: false,
    created_at: '2026-07-15T00:00:00.000Z',
  }
}

describe('buildStatusSummary', () => {
  it('calcula el pulso del salón de demostración', () => {
    const responses = [
      ...Array.from({ length: 7 }, (_, index) => response('understood', index)),
      ...Array.from({ length: 8 }, (_, index) => response('question', index + 7)),
      ...Array.from({ length: 5 }, (_, index) => response('lost', index + 15)),
    ]

    expect(buildStatusSummary(responses)).toEqual([
      { status: 'understood', count: 7, percentage: 35 },
      { status: 'question', count: 8, percentage: 40 },
      { status: 'lost', count: 5, percentage: 25 },
    ])
  })

  it('devuelve porcentajes en cero cuando aún no hay respuestas', () => {
    expect(buildStatusSummary([]).every((item) => item.percentage === 0)).toBe(true)
  })
})

describe('formatos de telemetría', () => {
  it('presenta duración y costo estimado en unidades legibles', () => {
    expect(formatDuration(850)).toBe('850 ms')
    expect(formatDuration(2350)).toBe('2.4 s')
    expect(formatEstimatedUsd(0.00382)).toContain('0.00382')
  })
})
