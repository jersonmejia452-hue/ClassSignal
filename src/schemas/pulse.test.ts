import { describe, expect, it } from 'vitest'

import { sessionPulseListSchema, sessionPulseSchema } from './pulse'

const activePulse = {
  id: '00000000-0000-4000-8000-000000000002',
  session_id: '00000000-0000-4000-8000-000000000001',
  ordinal: 2,
  is_active: true,
  questions_visible_to_students: false,
  started_at: '2026-07-18T23:00:00.000Z',
  ended_at: null,
}

describe('sessionPulseSchema', () => {
  it('acepta un pulso activo con ordinal positivo y sin fecha de cierre', () => {
    expect(sessionPulseSchema.parse(activePulse)).toEqual(activePulse)
  })

  it('acepta un pulso finalizado con fecha de cierre', () => {
    expect(sessionPulseSchema.safeParse({
      ...activePulse,
      is_active: false,
      ended_at: '2026-07-18T23:10:00.000Z',
    }).success).toBe(true)
  })

  it('rechaza estados temporales inconsistentes y campos inesperados', () => {
    expect(sessionPulseSchema.safeParse({
      ...activePulse,
      ended_at: '2026-07-18T23:10:00.000Z',
    }).success).toBe(false)
    expect(sessionPulseSchema.safeParse({
      ...activePulse,
      ordinal: 0,
    }).success).toBe(false)
    expect(sessionPulseSchema.safeParse({
      ...activePulse,
      professor_id: '00000000-0000-4000-8000-000000000003',
    }).success).toBe(false)
  })

  it('valida colecciones completas de pulsos', () => {
    expect(sessionPulseListSchema.parse([
      {
        ...activePulse,
        ordinal: 1,
        is_active: false,
        ended_at: '2026-07-18T22:50:00.000Z',
      },
      activePulse,
    ])).toHaveLength(2)
  })
})
