import { describe, expect, it } from 'vitest'

import {
  responseDraftSchema,
  responseSchema,
  responseSubmissionSecuritySchema,
} from './response'

describe('responseSchema', () => {
  it('acepta una señal sin pregunta y recorta el texto opcional', () => {
    expect(responseSchema.parse({
      status: 'question',
      questionText: '  No entiendo la magnitud.  ',
    })).toEqual({
      status: 'question',
      questionText: 'No entiendo la magnitud.',
    })
  })

  it('rechaza estados desconocidos y preguntas mayores a 1.000 caracteres', () => {
    expect(responseSchema.safeParse({ status: 'maybe' }).success).toBe(false)
    expect(responseSchema.safeParse({
      status: 'lost',
      questionText: 'a'.repeat(1001),
    }).success).toBe(false)
  })
})

describe('responseDraftSchema', () => {
  it('exige identificadores válidos de sesión, pulso y navegador', () => {
    const draft = {
      sessionId: '00000000-0000-4000-8000-000000000001',
      pulseId: '00000000-0000-4000-8000-000000000002',
      anonymousId: '00000000-0000-4000-8000-000000000003',
      status: 'understood',
      questionText: '  Ya lo entendí.  ',
    }

    expect(responseDraftSchema.parse(draft)).toMatchObject({
      ...draft,
      questionText: 'Ya lo entendí.',
    })
    expect(responseDraftSchema.safeParse({
      ...draft,
      pulseId: 'not-a-uuid',
    }).success).toBe(false)
    expect(responseDraftSchema.safeParse({
      ...draft,
      pulseId: undefined,
    }).success).toBe(false)
  })
})

describe('responseSubmissionSecuritySchema', () => {
  it('acepta solo la configuración pública mínima de Turnstile', () => {
    expect(responseSubmissionSecuritySchema.parse({
      turnstile: {
        siteKey: '1x00000000000000000000BB',
        action: 'submit_response',
      },
    })).toEqual({
      turnstile: {
        siteKey: '1x00000000000000000000BB',
        action: 'submit_response',
      },
    })

    expect(responseSubmissionSecuritySchema.safeParse({
      turnstile: {
        siteKey: 'short',
        action: 'login',
        secretKey: 'must-not-be-returned',
      },
    }).success).toBe(false)
  })
})
