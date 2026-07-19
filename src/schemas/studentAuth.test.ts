import { describe, expect, it } from 'vitest'

import { studentAuthSchema } from './studentAuth'

describe('studentAuthSchema', () => {
  it('recorta un correo válido y conserva únicamente el campo público', () => {
    expect(studentAuthSchema.parse({
      email: '  Estudiante@Universidad.edu  ',
      role: 'professor',
    })).toEqual({ email: 'Estudiante@Universidad.edu' })
  })

  it.each([
    '',
    'sin-arroba.example',
    `${'a'.repeat(245)}@example.com`,
  ])('rechaza el correo inválido %s', (email) => {
    expect(studentAuthSchema.safeParse({ email }).success).toBe(false)
  })
})
