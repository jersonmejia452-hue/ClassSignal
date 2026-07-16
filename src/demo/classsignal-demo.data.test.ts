import { describe, expect, it } from 'vitest'

import { buildStatusSummary } from '../lib/format'
import {
  createDemoResponses,
  DEMO_ANALYSIS,
  DEMO_BASE_RESPONSES,
  DEMO_DEFAULT_SIGNAL,
  DEMO_PULSE_HISTORY,
  DEMO_SESSION,
  DEMO_SIGNAL_TIMESTAMP,
} from './classsignal-demo.data'

describe('datos de la demostración de ClassSignal', () => {
  it('parte de 19 señales y completa el salón canónico de 20 personas', () => {
    expect(DEMO_BASE_RESPONSES).toHaveLength(19)

    const responses = createDemoResponses(DEMO_DEFAULT_SIGNAL)

    expect(responses).toHaveLength(20)
    expect(responses[0]).toMatchObject({
      status: 'question',
      question_text:
        '¿Cómo se conectan las componentes con la dirección del vector?',
      created_at: DEMO_SIGNAL_TIMESTAMP,
    })
    expect(buildStatusSummary(responses)).toEqual([
      { status: 'understood', count: 7, percentage: 35 },
      { status: 'question', count: 8, percentage: 40 },
      { status: 'lost', count: 5, percentage: 25 },
    ])
  })

  it('respeta la señal elegida y normaliza su duda opcional', () => {
    const responses = createDemoResponses({
      status: 'understood',
      questionText: '   ',
      createdAt: '2026-07-14T17:00:00.000Z',
    })

    expect(responses[0]).toMatchObject({
      status: 'understood',
      question_text: null,
      created_at: '2026-07-14T17:00:00.000Z',
    })
    expect(buildStatusSummary(responses)[0]).toEqual({
      status: 'understood',
      count: 8,
      percentage: 40,
    })
  })

  it('mantiene identificadores únicos y todas las señales en la misma clase', () => {
    const responses = createDemoResponses(DEMO_DEFAULT_SIGNAL)

    expect(new Set(responses.map((response) => response.id)).size).toBe(20)
    expect(
      new Set(responses.map((response) => response.anonymous_id)).size,
    ).toBe(20)
    expect(
      responses.every((response) => response.session_id === DEMO_SESSION.id),
    ).toBe(true)
  })

  it('conserva evidencia trazable dentro de las dudas simuladas', () => {
    const responses = createDemoResponses(DEMO_DEFAULT_SIGNAL)
    const questions = new Set(
      responses.flatMap((response) =>
        response.question_text ? [response.question_text] : [],
      ),
    )
    const evidence =
      DEMO_ANALYSIS.result?.concepts.flatMap((concept) => concept.evidence) ?? []

    expect(DEMO_ANALYSIS.response_count).toBe(responses.length)
    expect(
      DEMO_ANALYSIS.result?.concepts.every(
        (concept) => concept.evidence.length <= 3,
      ),
    ).toBe(true)
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence.every((quote) => questions.has(quote))).toBe(true)
  })

  it('define cuatro clases cronológicas con conteos internamente consistentes', () => {
    expect(DEMO_PULSE_HISTORY).toHaveLength(4)

    DEMO_PULSE_HISTORY.forEach((point) => {
      expect(
        point.understood_count + point.question_count + point.lost_count,
      ).toBe(point.response_count)
    })

    expect(
      DEMO_PULSE_HISTORY.every(
        (point, index, points) =>
          index === 0
          || Date.parse(points[index - 1]!.created_at)
            < Date.parse(point.created_at),
      ),
    ).toBe(true)
    expect(
      DEMO_PULSE_HISTORY.every(
        (point) =>
          Date.parse(point.created_at)
          <= Date.parse('2026-07-16T23:59:59.999Z'),
      ),
    ).toBe(true)
    expect(DEMO_PULSE_HISTORY[0]).toMatchObject({
      response_count: 20,
      understood_count: 7,
      question_count: 8,
      lost_count: 5,
    })
    expect(DEMO_PULSE_HISTORY.at(-1)).toMatchObject({
      response_count: 20,
      understood_count: 14,
      question_count: 4,
      lost_count: 2,
    })
  })
})
