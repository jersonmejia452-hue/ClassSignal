import { describe, expect, it } from 'vitest'

import {
  canOpenNextPulse,
  isPulseInInterventionCycle,
  wasInterventionReadyBeforePulse,
} from './SessionDetailPage'

const readyOpening = {
  activeResponseCount: 1,
  artifactWorkInProgress: false,
  hasActivePulse: true,
  hasCurrentPulseIntervention: false,
  interventionIsOutdated: false,
  interventionSourcesReady: true,
  isLoadingPulseSources: false,
  isOpeningPulse: false,
  isRealtimeConnected: true,
  pulseCount: 1,
  pulseSourcesHaveErrors: false,
  sessionIsActive: true,
}

describe('SessionDetailPage pulse authorization', () => {
  it('permite iniciar el primer pulso sin exigir una intervención', () => {
    expect(canOpenNextPulse({
      ...readyOpening,
      activeResponseCount: 0,
      hasActivePulse: false,
      interventionSourcesReady: false,
      pulseCount: 0,
    })).toBe(true)
  })

  it('permite avanzar sin intervención aunque el análisis no esté disponible', () => {
    expect(canOpenNextPulse({
      ...readyOpening,
      interventionIsOutdated: true,
      interventionSourcesReady: false,
    })).toBe(true)
  })

  it('permite reactivar una clase aunque su último pulso no tenga respuestas', () => {
    expect(canOpenNextPulse({
      ...readyOpening,
      activeResponseCount: 0,
      hasActivePulse: false,
      pulseCount: 2,
    })).toBe(true)
  })

  it('bloquea cualquier apertura mientras se genera una intervención', () => {
    expect(canOpenNextPulse({
      ...readyOpening,
      artifactWorkInProgress: true,
    })).toBe(false)
  })

  it('bloquea una intervención actual obsoleta o con fuentes no verificables', () => {
    expect(canOpenNextPulse({
      ...readyOpening,
      hasCurrentPulseIntervention: true,
      interventionIsOutdated: true,
    })).toBe(false)
    expect(canOpenNextPulse({
      ...readyOpening,
      hasCurrentPulseIntervention: true,
      interventionSourcesReady: false,
    })).toBe(false)
  })
})

describe('SessionDetailPage intervention cycle boundaries', () => {
  it('limita la intervención al pulso fuente y su medición inmediatamente posterior', () => {
    expect(isPulseInInterventionCycle(2, 2)).toBe(true)
    expect(isPulseInInterventionCycle(2, 3)).toBe(true)
    expect(isPulseInInterventionCycle(2, 4)).toBe(false)
    expect(isPulseInInterventionCycle(2, 1)).toBe(false)
  })

  it('rechaza resultados que terminaron después de iniciar el siguiente pulso', () => {
    const nextPulseStartedAt = '2026-07-21T15:00:00.000Z'

    expect(wasInterventionReadyBeforePulse(
      '2026-07-21T14:59:59.000Z',
      nextPulseStartedAt,
    )).toBe(true)
    expect(wasInterventionReadyBeforePulse(
      nextPulseStartedAt,
      nextPulseStartedAt,
    )).toBe(true)
    expect(wasInterventionReadyBeforePulse(
      '2026-07-21T15:00:01.000Z',
      nextPulseStartedAt,
    )).toBe(false)
    expect(wasInterventionReadyBeforePulse(null, nextPulseStartedAt)).toBe(false)
    expect(wasInterventionReadyBeforePulse('invalid', nextPulseStartedAt)).toBe(false)
  })
})
