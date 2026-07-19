export const understandingStatuses = ['understood', 'question', 'lost'] as const

export type UnderstandingStatus = (typeof understandingStatuses)[number]

export interface ClassSession {
  id: string
  professor_id: string
  course_id: string | null
  code: string
  title: string
  subject: string
  topic: string
  is_active: boolean
  questions_visible_to_students: boolean
  created_at: string
  updated_at: string
  ended_at: string | null
}

export interface SessionPulse {
  id: string
  session_id: string
  ordinal: number
  is_active: boolean
  questions_visible_to_students: boolean
  started_at: string
  ended_at: string | null
}

export interface Course {
  id: string
  professor_id: string
  name: string
  subject: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface CourseDraft {
  name: string
  subject: string
  description?: string | null
}

export interface CoursePulsePoint {
  session_id: string
  title: string
  created_at: string
  is_active: boolean
  response_count: number
  understood_count: number
  question_count: number
  lost_count: number
}

export interface PublicClassSession {
  id: string
  code: string
  title: string
  subject: string
  topic: string
  is_active: boolean
  active_pulse_id: string | null
  active_pulse_ordinal: number | null
  active_pulse_started_at: string | null
}

export interface StudentResponse {
  id: string
  session_id: string
  pulse_id: string
  anonymous_id: string
  status: UnderstandingStatus
  question_text: string | null
  is_visible_to_students: boolean
  created_at: string
}

export interface PublicSessionQuestion {
  id: string
  question_text: string
}

export interface QuestionWallPayload {
  visible: boolean
  pulse_id: string
  questions: PublicSessionQuestion[]
}

export interface SessionDraft {
  title: string
  subject: string
  topic: string
  courseId?: string | null
}

export interface ResponseDraft {
  sessionId: string
  pulseId: string
  anonymousId: string
  status: UnderstandingStatus
  questionText?: string
}

export interface ResponseSubmissionSecurity {
  turnstile: {
    siteKey: string
    action: 'submit_response'
  }
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
  pulse_id: string
  professor_id: string
  status: AnalysisStatus
  model: string
  prompt_version: number
  response_count: number
  source_latest_response_at: string
  result: ConfusionMap | null
  error_message: string | null
  input_tokens: number | null
  cached_input_tokens: number | null
  output_tokens: number | null
  reasoning_tokens: number | null
  total_tokens: number | null
  estimated_cost_usd: number | null
  pricing_version: string | null
  duration_ms: number | null
  provider_request_id: string | null
  provider_response_id: string | null
  created_at: string
  completed_at: string | null
}
