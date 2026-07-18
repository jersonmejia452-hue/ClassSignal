import { questionWallPayloadSchema } from '../schemas/questionWall'
import type { QuestionWallPayload } from '../types/domain'
import { getPublicSupabase } from './supabase'

const publicQuestionLimit = 50

export async function getStudentQuestionWall(
  sessionId: string,
): Promise<QuestionWallPayload> {
  const { data, error } = await getPublicSupabase().rpc(
    'get_student_question_wall',
    {
      p_session_id: sessionId,
      p_limit: publicQuestionLimit,
    },
  )

  if (error) throw error

  const parsed = questionWallPayloadSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error('El servidor devolvió un muro de dudas inesperado.')
  }

  return parsed.data
}
