import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getPublicSupabase: () => ({ rpc: rpcMock }),
}))

import { getStudentQuestionWall } from './questions.service'

const sessionId = '00000000-0000-4000-8000-000000000001'
const pulseId = '00000000-0000-4000-8000-000000000003'

describe('getStudentQuestionWall', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('consulta únicamente la RPC pública y limita el muro a 50 dudas', async () => {
    rpcMock.mockResolvedValue({
      data: {
        visible: true,
        pulse_id: pulseId,
        questions: [{
          id: '00000000-0000-4000-8000-000000000002',
          question_text: '¿Cómo interpreto la dirección del vector?',
        }],
      },
      error: null,
    })

    await expect(getStudentQuestionWall(sessionId, pulseId)).resolves.toMatchObject({
      visible: true,
      questions: [{
        question_text: '¿Cómo interpreto la dirección del vector?',
      }],
    })
    expect(rpcMock).toHaveBeenCalledWith('get_student_question_wall', {
      p_session_id: sessionId,
      p_pulse_id: pulseId,
      p_limit: 50,
    })
  })

  it('propaga errores de Supabase', async () => {
    const rpcError = new Error('rpc unavailable')
    rpcMock.mockResolvedValue({ data: null, error: rpcError })

    await expect(getStudentQuestionWall(sessionId, pulseId)).rejects.toBe(rpcError)
  })

  it('rechaza respuestas que intenten incluir datos privados', async () => {
    rpcMock.mockResolvedValue({
      data: {
        visible: true,
        pulse_id: pulseId,
        questions: [{
          id: '00000000-0000-4000-8000-000000000002',
          question_text: '¿Qué diferencia hay entre dirección y sentido?',
          status: 'lost',
        }],
      },
      error: null,
    })

    await expect(getStudentQuestionWall(sessionId, pulseId)).rejects.toThrow(
      'El servidor devolvió un muro de dudas inesperado.',
    )
  })

  it('rechaza un payload atribuido a otro pulso', async () => {
    rpcMock.mockResolvedValue({
      data: {
        visible: true,
        pulse_id: '00000000-0000-4000-8000-000000000004',
        questions: [],
      },
      error: null,
    })

    await expect(getStudentQuestionWall(sessionId, pulseId)).rejects.toThrow(
      'El servidor devolvió dudas de un pulso distinto.',
    )
  })
})
