import { describe, expect, it } from 'vitest'

import type { CoursePulsePoint } from '../types/domain'
import {
  buildCoursePulseMetrics,
  getCoursePulseDistribution,
} from './coursePulse'

function pulsePoint(
  overrides: Partial<CoursePulsePoint> = {},
): CoursePulsePoint {
  return {
    session_id: crypto.randomUUID(),
    title: 'Clase de prueba',
    created_at: '2026-07-14T14:00:00.000Z',
    is_active: false,
    response_count: 20,
    understood_count: 7,
    question_count: 8,
    lost_count: 5,
    ...overrides,
  }
}

describe('getCoursePulseDistribution', () => {
  it('calcula la distribución de una clase de veinte estudiantes', () => {
    expect(getCoursePulseDistribution(pulsePoint())).toEqual({
      understood: 35,
      question: 40,
      lost: 25,
    })
  })

  it('devuelve ceros para una clase todavía sin respuestas', () => {
    expect(getCoursePulseDistribution(pulsePoint({
      response_count: 0,
      understood_count: 0,
      question_count: 0,
      lost_count: 0,
    }))).toEqual({ understood: 0, question: 0, lost: 0 })
  })
})

describe('buildCoursePulseMetrics', () => {
  it('pondera por respuestas y no promedia porcentajes de clases', () => {
    const metrics = buildCoursePulseMetrics([
      pulsePoint({
        session_id: crypto.randomUUID(),
        created_at: '2026-07-13T14:00:00.000Z',
        response_count: 10,
        understood_count: 10,
        question_count: 0,
        lost_count: 0,
      }),
      pulsePoint({
        session_id: crypto.randomUUID(),
        created_at: '2026-07-14T14:00:00.000Z',
        response_count: 30,
        understood_count: 0,
        question_count: 20,
        lost_count: 10,
      }),
    ])

    expect(metrics.totalResponses).toBe(40)
    expect(metrics.weightedDistribution).toEqual({
      understood: 25,
      question: 50,
      lost: 25,
    })
  })

  it('ignora clases vacías al calcular la tendencia reciente', () => {
    const metrics = buildCoursePulseMetrics([
      pulsePoint({
        session_id: crypto.randomUUID(),
        created_at: '2026-07-12T14:00:00.000Z',
        understood_count: 7,
      }),
      pulsePoint({
        session_id: crypto.randomUUID(),
        created_at: '2026-07-13T14:00:00.000Z',
        response_count: 0,
        understood_count: 0,
        question_count: 0,
        lost_count: 0,
      }),
      pulsePoint({
        session_id: crypto.randomUUID(),
        created_at: '2026-07-14T14:00:00.000Z',
        understood_count: 11,
        question_count: 6,
        lost_count: 3,
      }),
    ])

    expect(metrics.measuredSessions).toBe(2)
    expect(metrics.latestUnderstoodPercentage).toBe(55)
    expect(metrics.trendDelta).toBe(20)
    expect(metrics.trend).toBe('up')
  })

  it.each([
    { latest: 5, expectedDelta: -10, expectedTrend: 'down' },
    { latest: 7, expectedDelta: 0, expectedTrend: 'stable' },
  ] as const)(
    'clasifica una tendencia $expectedTrend',
    ({ latest, expectedDelta, expectedTrend }) => {
      const metrics = buildCoursePulseMetrics([
        pulsePoint({
          session_id: crypto.randomUUID(),
          created_at: '2026-07-13T14:00:00.000Z',
          understood_count: 7,
        }),
        pulsePoint({
          session_id: crypto.randomUUID(),
          created_at: '2026-07-14T14:00:00.000Z',
          understood_count: latest,
          question_count: 20 - latest,
          lost_count: 0,
        }),
      ])

      expect(metrics.trendDelta).toBe(expectedDelta)
      expect(metrics.trend).toBe(expectedTrend)
    },
  )

  it('no inventa una tendencia con una sola clase medida', () => {
    const metrics = buildCoursePulseMetrics([pulsePoint()])

    expect(metrics.measuredSessions).toBe(1)
    expect(metrics.trendDelta).toBeNull()
    expect(metrics.trend).toBeNull()
  })
})
