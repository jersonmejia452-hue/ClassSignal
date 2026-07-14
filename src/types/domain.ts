export const understandingStatuses = ['understood', 'question', 'lost'] as const

export type UnderstandingStatus = (typeof understandingStatuses)[number]

export interface ClassSession {
  id: string
  professor_id: string
  code: string
  title: string
  subject: string
  topic: string
  is_active: boolean
  created_at: string
  updated_at: string
  ended_at: string | null
}

export interface PublicClassSession {
  id: string
  code: string
  title: string
  subject: string
  topic: string
  is_active: boolean
}

export interface StudentResponse {
  id: string
  session_id: string
  anonymous_id: string
  status: UnderstandingStatus
  question_text: string | null
  created_at: string
}

export interface SessionDraft {
  title: string
  subject: string
  topic: string
}

export interface ResponseDraft {
  sessionId: string
  anonymousId: string
  status: UnderstandingStatus
  questionText?: string
}

export interface StatusSummaryItem {
  status: UnderstandingStatus
  count: number
  percentage: number
}
