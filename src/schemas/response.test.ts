import { describe, expect, it } from 'vitest'

import { responseSchema } from './response'

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
