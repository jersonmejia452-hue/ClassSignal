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

export const analysisStatuses = ['pending', 'completed', 'failed'] as const
export const confusionLevels = ['low', 'medium', 'high', 'critical'] as const
export const analysisSeverities = ['low', 'medium', 'high'] as const
export const recommendationPriorities = ['now', 'next', 'later'] as const
export const analysisResponseLimit = 500
export const analysisPendingTimeoutMs = 10 * 60 * 1000

export type AnalysisStatus = (typeof analysisStatuses)[number]
export type ConfusionLevel = (typeof confusionLevels)[number]
export type AnalysisSeverity = (typeof analysisSeverities)[number]
export type RecommendationPriority = (typeof recommendationPriorities)[number]

export interface ConfusionConcept {
  concept: string
  explanation: string
  severity: AnalysisSeverity
  affected_students: number
  evidence: string[]
}

export interface TeachingRecommendation {
  title: string
  action: string
  priority: RecommendationPriority
}

export interface ConfusionMap {
  overview: string
  confusion_level: ConfusionLevel
  concepts: ConfusionConcept[]
  recommendations: TeachingRecommendation[]
}

export interface SessionAnalysis {
  id: string
  session_id: string
  professor_id: string
  status: AnalysisStatus
  model: string
  prompt_version: number
  response_count: number
  source_latest_response_at: string
  result: ConfusionMap | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}
