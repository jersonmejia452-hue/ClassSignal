import { z } from 'zod'

export const publicSessionQuestionSchema = z.object({
  id: z.string().uuid(),
  question_text: z.string().trim().min(1).max(1000),
}).strict()

export const questionWallPayloadSchema = z.object({
  visible: z.boolean(),
  pulse_id: z.string().uuid(),
  questions: z.array(publicSessionQuestionSchema).max(50),
}).strict().refine(
  ({ visible, questions }) => visible || questions.length === 0,
  {
    message: 'Un muro oculto no puede incluir preguntas.',
    path: ['questions'],
  },
)
