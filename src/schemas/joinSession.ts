import { z } from 'zod'

const sessionCodePattern = /^[A-HJ-NP-Z2-9]{6}$/

export const joinSessionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, 'Escribe los 6 caracteres del código.')
    .regex(
      sessionCodePattern,
      'Usa letras y números del 2 al 9. El código no contiene I, O, 0 ni 1.',
    ),
})

export type JoinSessionFormValues = z.infer<typeof joinSessionSchema>
