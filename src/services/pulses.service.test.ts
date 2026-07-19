import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  channelMock,
  fromMock,
  removeChannelMock,
  rpcMock,
} = vi.hoisted(() => ({
  channelMock: vi.fn(),
  fromMock: vi.fn(),
  removeChannelMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getTeacherSupabase: () => ({
    channel: channelMock,
    from: fromMock,
    removeChannel: removeChannelMock,
    rpc: rpcMock,
  }),
}))

import {
  getSessionPulses,
  openNextSessionPulse,
  setPulseQuestionsVisible,
  subscribeToSessionPulses,
} from './pulses.service'

const sessionId = '00000000-0000-4000-8000-000000000001'
const pulse = {
  id: '00000000-0000-4000-8000-000000000002',
  session_id: sessionId,
  ordinal: 1,
  is_active: true,
  questions_visible_to_students: false,
  started_at: '2026-07-18T23:00:00.000Z',
  ended_at: null,
}

describe('pulses.service', () => {
  beforeEach(() => {
    channelMock.mockReset()
    fromMock.mockReset()
    removeChannelMock.mockReset()
    rpcMock.mockReset()
  })

  it('lista los pulsos de una sesión en orden cronológico', async () => {
    const order = vi.fn().mockResolvedValue({ data: [pulse], error: null })
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    fromMock.mockReturnValue({ select })

    await expect(getSessionPulses(sessionId)).resolves.toEqual([pulse])
    expect(fromMock).toHaveBeenCalledWith('session_pulses')
    expect(eq).toHaveBeenCalledWith('session_id', sessionId)
    expect(order).toHaveBeenCalledWith('ordinal', { ascending: true })
  })

  it('abre el siguiente pulso mediante la RPC atómica', async () => {
    rpcMock.mockResolvedValue({ data: pulse, error: null })

    await expect(openNextSessionPulse(sessionId)).resolves.toEqual(pulse)
    expect(rpcMock).toHaveBeenCalledWith('open_next_session_pulse', {
      p_session_id: sessionId,
    })
  })

  it('actualiza solo la visibilidad estudiantil del pulso', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { ...pulse, questions_visible_to_students: true },
      error: null,
    })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    fromMock.mockReturnValue({ update })

    await expect(setPulseQuestionsVisible(pulse.id, true)).resolves.toMatchObject({
      questions_visible_to_students: true,
    })
    expect(update).toHaveBeenCalledWith({ questions_visible_to_students: true })
    expect(eq).toHaveBeenCalledWith('id', pulse.id)
  })

  it('suscribe cambios Realtime limitados a la sesión', () => {
    const subscribe = vi.fn(() => ({ topic: 'channel' }))
    const on = vi.fn(() => ({ subscribe }))
    channelMock.mockReturnValue({ on })

    const onChange = vi.fn()
    const onStatus = vi.fn()
    subscribeToSessionPulses(sessionId, onChange, onStatus)

    expect(channelMock).toHaveBeenCalledWith(`session-pulses:${sessionId}`)
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        table: 'session_pulses',
        filter: `session_id=eq.${sessionId}`,
      }),
      onChange,
    )
  })
})
