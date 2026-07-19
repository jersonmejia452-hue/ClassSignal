import { describe, expect, it } from 'vitest'

import { studentEnrollmentSchema } from './studentEnrollment'

describe('studentEnrollmentSchema', () => {
  it('normaliza el código permanente del curso', () => {
    expect(studentEnrollmentSchema.parse({
      code: '  abcd2345  ',
      course_id: 'private-value',
    })).toEqual({ code: 'ABCD2345' })
  })

  it.each([
    'ABC2345',
    'ABCDE2345',
    'ABCI2345',
    'ABCO2345',
    'ABC02345',
    'ABC12345',
    'ABC-2345',
  ])('rechaza el código ambiguo o inválido %s', (code) => {
    expect(studentEnrollmentSchema.safeParse({ code }).success).toBe(false)
  })
})
