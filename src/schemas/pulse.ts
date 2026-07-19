import { z } from 'zod'

export const sessionPulseSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  ordinal: z.number().int().positive(),
  is_active: z.boolean(),
  questions_visible_to_students: z.boolean(),
  started_at: z.string().min(1),
  ended_at: z.string().min(1).nullable(),
}).strict().refine(
  ({ is_active, ended_at }) => (is_active ? ended_at === null : ended_at !== null),
  {
    message: 'El estado del pulso no coincide con su fecha de cierre.',
    path: ['ended_at'],
  },
)

export const sessionPulseListSchema = z.array(sessionPulseSchema)

export type SessionPulseData = z.infer<typeof sessionPulseSchema>
