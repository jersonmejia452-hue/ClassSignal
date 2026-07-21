import { describe, expect, it } from 'vitest'

import type { StudentResponse, UnderstandingStatus } from '../types/domain'
import { buildCollectiveCycleComparison } from './collectiveCycle'

function statuses(
  status: UnderstandingStatus,
  count: number,
): Array<Pick<StudentResponse, 'status'>> {
  return Array.from({ length: count }, () => ({ status }))
}

function pulse(
  understood: number,
  question: number,
  lost: number,
): Array<Pick<StudentResponse, 'status'>> {
  return [
    ...statuses('understood', understood),
    ...statuses('question', question),
    ...statuses('lost', lost),
  ]
}

describe('buildCollectiveCycleComparison', () => {
  it('calcula conteos, porcentajes y deltas con cada población por separado', () => {
    const comparison = buildCollectiveCycleComparison(
      pulse(10, 5, 5),
      pulse(7, 2, 1),
    )

    expect(comparison.before).toEqual({
      responseCount: 20,
      counts: { understood: 10, question: 5, lost: 5 },
      percentages: { understood: 50, question: 25, lost: 25 },
    })
    expect(comparison.after).toEqual({
      responseCount: 10,
      counts: { understood: 7, question: 2, lost: 1 },
      percentages: { understood: 70, question: 20, lost: 10 },
    })
    expect(comparison.deltaPercentagePoints).toEqual({
      understood: 20,
      question: -5,
      lost: -15,
    })
    expect(comparison.state).toBe('compared')
    expect(comparison.outcome).toBe('improved')
  })

  it('no empareja identificadores ni reduce los grupos al menor tamaño', () => {
    const before = pulse(2, 2, 1).map((response, index) => ({
      ...response,
      id: `before-${index}`,
      anonymous_id: `before-person-${index}`,
    }))
    const after = pulse(3, 0, 0).map((response, index) => ({
      ...response,
      id: `after-${index}`,
      anonymous_id: `after-person-${index}`,
    }))

    const comparison = buildCollectiveCycleComparison(before, after)

    expect(comparison.before.responseCount).toBe(5)
    expect(comparison.after.responseCount).toBe(3)
    expect(comparison.before.counts).toEqual({
      understood: 2,
      question: 2,
      lost: 1,
    })
    expect(comparison.after.counts).toEqual({
      understood: 3,
      question: 0,
      lost: 0,
    })
  })

  it('espera de forma neutral cuando el pulso posterior no tiene respuestas', () => {
    const comparison = buildCollectiveCycleComparison(pulse(5, 3, 2), [])

    expect(comparison.state).toBe('waiting')
    expect(comparison.outcome).toBe('neutral')
    expect(comparison.after.responseCount).toBe(0)
    expect(comparison.after.percentages).toEqual({
      understood: 0,
      question: 0,
      lost: 0,
    })
    expect(comparison.deltaPercentagePoints).toEqual({
      understood: null,
      question: null,
      lost: null,
    })
  })

  it('se mantiene cuando Entendí y Estoy perdido no cambian', () => {
    const comparison = buildCollectiveCycleComparison(
      pulse(5, 3, 2),
      pulse(10, 6, 4),
    )

    expect(comparison.deltaPercentagePoints).toEqual({
      understood: 0,
      question: 0,
      lost: 0,
    })
    expect(comparison.outcome).toBe('stable')
  })

  it.each([
    {
      label: 'sube Entendí sin subir Estoy perdido',
      after: pulse(6, 2, 2),
    },
    {
      label: 'baja Estoy perdido sin bajar Entendí',
      after: pulse(5, 4, 1),
    },
  ])('clasifica como mejora cuando $label', ({ after }) => {
    const comparison = buildCollectiveCycleComparison(
      pulse(5, 3, 2),
      after,
    )

    expect(comparison.outcome).toBe('improved')
  })

  it.each([
    {
      label: 'Entendí baja aunque también baje Estoy perdido',
      after: pulse(4, 5, 1),
    },
    {
      label: 'Estoy perdido sube aunque también suba Entendí',
      after: pulse(6, 1, 3),
    },
    {
      label: 'solo empeora Entendí',
      after: pulse(4, 4, 2),
    },
    {
      label: 'solo empeora Estoy perdido',
      after: pulse(5, 2, 3),
    },
  ])('requiere seguimiento cuando $label', ({ after }) => {
    const comparison = buildCollectiveCycleComparison(
      pulse(5, 3, 2),
      after,
    )

    expect(comparison.outcome).toBe('follow_up')
  })

  it('no inventa un resultado si falta el pulso base', () => {
    const comparison = buildCollectiveCycleComparison([], pulse(4, 4, 2))

    expect(comparison.state).toBe('compared')
    expect(comparison.outcome).toBe('neutral')
    expect(comparison.deltaPercentagePoints.understood).toBeNull()
  })
})
