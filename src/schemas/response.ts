import { z } from 'zod'

import { understandingStatuses } from '../types/domain'

export const responseSchema = z.object({
  status: z.enum(understandingStatuses, {
    error: 'Selecciona cómo te sientes con el tema.',
  }),
  questionText: z
    .string()
    .trim()
    .max(1000, 'La duda no puede superar 1.000 caracteres.')
    .optional(),
})

export type ResponseFormValues = z.infer<typeof responseSchema>
