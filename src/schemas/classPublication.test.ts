import { describe, expect, it } from 'vitest'

import { classPublicationSchema } from './classPublication'

describe('classPublicationSchema', () => {
  it('normaliza el resumen, convierte recursos vacíos en null y omite extras', () => {
    expect(classPublicationSchema.parse({
      summary: '  Repasamos la regla de la cadena.  ',
      resources: '   ',
      questions_published: true,
      professor_id: 'private-value',
    })).toEqual({
      summary: 'Repasamos la regla de la cadena.',
      resources: null,
      questions_published: true,
    })
  })

  it('recorta recursos publicados', () => {
    expect(classPublicationSchema.parse({
      summary: 'Resumen suficientemente largo.',
      resources: '  Capítulo 3, páginas 20–24.  ',
      questions_published: false,
    }).resources).toBe('Capítulo 3, páginas 20–24.')
  })

  it('rechaza resúmenes y recursos fuera de sus límites', () => {
    expect(classPublicationSchema.safeParse({
      summary: 'Corto',
      resources: '',
      questions_published: false,
    }).success).toBe(false)

    expect(classPublicationSchema.safeParse({
      summary: 'a'.repeat(5001),
      resources: '',
      questions_published: false,
    }).success).toBe(false)

    expect(classPublicationSchema.safeParse({
      summary: 'Resumen suficientemente largo.',
      resources: 'a'.repeat(2001),
      questions_published: true,
    }).success).toBe(false)
  })
})
