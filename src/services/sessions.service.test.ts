import { beforeEach, describe, expect, it, vi } from 'vitest'

const { publicRpcMock, teacherRpcMock } = vi.hoisted(() => ({
  publicRpcMock: vi.fn(),
  teacherRpcMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getPublicSupabase: () => ({ rpc: publicRpcMock }),
  getTeacherSupabase: () => ({ rpc: teacherRpcMock }),
}))

import { getPublicSession, setSessionActive } from './sessions.service'

const sessionId = '00000000-0000-4000-8000-000000000001'

describe('sessions.service pulse contracts', () => {
  beforeEach(() => {
    publicRpcMock.mockReset()
    teacherRpcMock.mockReset()
  })

  it('cambia el estado de la clase mediante una sola RPC', async () => {
    const session = { id: sessionId, is_active: false }
    teacherRpcMock.mockResolvedValue({ data: session, error: null })

    await expect(setSessionActive(sessionId, false)).resolves.toBe(session)
    expect(teacherRpcMock).toHaveBeenCalledWith('set_session_active', {
      p_session_id: sessionId,
      p_is_active: false,
    })
  })

  it('normaliza como nulo el pulso activo ausente en una respuesta legacy', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: sessionId,
        code: 'AULA24',
        title: 'Clase',
        subject: 'Cálculo',
        topic: 'Límites',
        is_active: true,
      },
      error: null,
    })
    publicRpcMock.mockReturnValue({ maybeSingle })

    await expect(getPublicSession(' aula24 ')).resolves.toMatchObject({
      active_pulse_id: null,
      active_pulse_ordinal: null,
      active_pulse_started_at: null,
    })
    expect(publicRpcMock).toHaveBeenCalledWith('get_public_session', {
      p_code: 'AULA24',
    })
  })
})
