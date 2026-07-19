import { z } from 'zod'

export const studentEnrollmentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,
      'Escribe el código de 8 caracteres que compartió tu profesor.',
    ),
})

export type StudentEnrollmentValues = z.infer<typeof studentEnrollmentSchema>
