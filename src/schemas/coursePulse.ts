import { z } from 'zod'

export const coursePulsePointSchema = z.object({
  session_id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  created_at: z.string().min(1),
  is_active: z.boolean(),
  response_count: z.number().int().nonnegative(),
  understood_count: z.number().int().nonnegative(),
  question_count: z.number().int().nonnegative(),
  lost_count: z.number().int().nonnegative(),
}).refine(
  (point) => (
    point.understood_count
      + point.question_count
      + point.lost_count
    === point.response_count
  ),
  { message: 'Los conteos del pulso no coinciden con el total de respuestas.' },
)

export const coursePulseHistorySchema = z.array(coursePulsePointSchema).max(24)
