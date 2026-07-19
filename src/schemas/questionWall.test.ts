import { describe, expect, it } from 'vitest'

import { questionWallPayloadSchema } from './questionWall'

const question = {
  id: '00000000-0000-4000-8000-000000000001',
  question_text: '¿Por qué una componente puede ser negativa?',
}

const pulseId = '00000000-0000-4000-8000-000000000002'

describe('questionWallPayloadSchema', () => {
  it('acepta un muro visible con preguntas públicas mínimas', () => {
    expect(questionWallPayloadSchema.parse({
      visible: true,
      pulse_id: pulseId,
      questions: [question],
    })).toEqual({
      visible: true,
      pulse_id: pulseId,
      questions: [question],
    })
  })

  it('acepta un muro oculto únicamente cuando no incluye preguntas', () => {
    expect(questionWallPayloadSchema.parse({
      visible: false,
      pulse_id: pulseId,
      questions: [],
    })).toEqual({ visible: false, pulse_id: pulseId, questions: [] })

    expect(questionWallPayloadSchema.safeParse({
      visible: false,
      pulse_id: pulseId,
      questions: [question],
    }).success).toBe(false)
  })

  it.each([
    { ...question, anonymous_id: 'anonymous-1' },
    { ...question, status: 'lost' },
    { ...question, session_id: '00000000-0000-4000-8000-000000000002' },
  ])('rechaza campos privados o inesperados en una pregunta', (unsafeQuestion) => {
    expect(questionWallPayloadSchema.safeParse({
      visible: true,
      pulse_id: pulseId,
      questions: [unsafeQuestion],
    }).success).toBe(false)
  })

  it('rechaza campos inesperados en el payload', () => {
    expect(questionWallPayloadSchema.safeParse({
      visible: true,
      pulse_id: pulseId,
      questions: [question],
      total: 1,
    }).success).toBe(false)
  })

  it('rechaza preguntas vacías y más de 50 elementos', () => {
    expect(questionWallPayloadSchema.safeParse({
      visible: true,
      pulse_id: pulseId,
      questions: [{ ...question, question_text: '   ' }],
    }).success).toBe(false)

    expect(questionWallPayloadSchema.safeParse({
      visible: true,
      pulse_id: pulseId,
      questions: Array.from({ length: 51 }, (_, index) => ({
        ...question,
        id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
      })),
    }).success).toBe(false)
  })
})
