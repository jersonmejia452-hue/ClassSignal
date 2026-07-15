import { describe, expect, it } from 'vitest'

import { joinSessionSchema } from './joinSession'

describe('joinSessionSchema', () => {
  it('normaliza códigos válidos antes de consultar la sesión', () => {
    expect(joinSessionSchema.parse({ code: '  qxj4ye ' })).toEqual({
      code: 'QXJ4YE',
    })
  })

  it.each(['ABC12', 'ABC1O2', 'ABC-23', '123456'])(
    'rechaza el código ambiguo o inválido %s',
    (code) => {
      expect(joinSessionSchema.safeParse({ code }).success).toBe(false)
    },
  )
})
