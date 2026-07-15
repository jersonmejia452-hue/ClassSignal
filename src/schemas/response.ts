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

export const responseSubmissionSchema = z.object({
  accepted: z.literal(true),
})

export const responseSubmissionSecuritySchema = z.object({
  turnstile: z.object({
    siteKey: z.string().min(20),
    action: z.literal('submit_response'),
  }),
})

export const responseSubmissionErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
})

export type ResponseFormValues = z.infer<typeof responseSchema>
