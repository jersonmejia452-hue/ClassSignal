export const understandingStatuses = ['understood', 'question', 'lost'] as const

export type UnderstandingStatus = (typeof understandingStatuses)[number]

export const accountRoles = ['professor', 'student'] as const

export type AccountRole = (typeof accountRoles)[number]

export const maximumSessionPulseCount = 6

export interface AccountProfile {
  id: string
  role: AccountRole
  display_name: string | null
  created_at: string
  updated_at: string
}

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
  enrollment_code: string
  enrollment_open: boolean
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

export interface StudentCourse {
  course_id: string
  name: string
  subject: string
  description: string | null
  joined_at: string
  session_count: number
  active_session_count: number
  latest_session_at: string | null
}

export interface StudentCourseDetails {
  course_id: string
  name: string
  subject: string
  description: string | null
  joined_at: string
}

export interface StudentCourseSession {
  session_id: string
  code: string
  title: string
  subject: string
  topic: string
  is_active: boolean
  created_at: string
  ended_at: string | null
  has_publication: boolean
  questions_published: boolean
}

export interface StudentSessionArchive {
  session_id: string
  course_id: string
  course_name: string
  code: string
  title: string
  subject: string
  topic: string
  is_active: boolean
  created_at: string
  ended_at: string | null
  summary: string | null
  resources: string | null
  questions_published: boolean
  published_at: string | null
}

export interface StudentArchiveQuestion {
  response_id: string
  pulse_ordinal: number
  question_text: string
}

export interface EnrollmentResult {
  course_id: string
  enrollment_status: 'joined' | 'already_enrolled'
}

export interface SessionPublication {
  session_id: string
  summary: string
  resources: string | null
  questions_published: boolean
  published_at: string
  updated_at: string
}

export interface SessionPublicationDraft {
  summary: string
  resources: string | null
  questions_published: boolean
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

export const sessionAiArtifactKinds = [
  'publication_draft',
  'micro_intervention',
] as const
export const sessionAiArtifactStatuses = ['pending', 'completed', 'failed'] as const
export const sessionAiArtifactReasoningEfforts = ['low', 'medium', 'high', 'xhigh'] as const
export const sessionAiArtifactPendingTimeoutMs = 10 * 60 * 1000

export type SessionAiArtifactKind = (typeof sessionAiArtifactKinds)[number]
export type SessionAiArtifactStatus = (typeof sessionAiArtifactStatuses)[number]
export type SessionAiArtifactReasoningEffort = (typeof sessionAiArtifactReasoningEfforts)[number]

export interface PublicationDraftReviewNote {
  field: 'summary' | 'resources'
  message: string
}

export interface PublicationDraftArtifactResult {
  summary: string
  resources_and_next_steps: string
  review_notes: PublicationDraftReviewNote[]
}

export interface MicroInterventionStep {
  instruction: string
  duration_minutes: number
}

export interface MicroInterventionResult {
  title: string
  objective: string
  duration_minutes: number
  explanation: string
  example: string
  steps: MicroInterventionStep[]
  check_question: string
  expected_answer: string
  misconception_to_watch: string
  follow_up_action: string
}

interface SessionAiArtifactBase {
  id: string
  professor_id: string
  session_id: string
  status: SessionAiArtifactStatus
  model: string
  reasoning_effort: SessionAiArtifactReasoningEffort
  prompt_version: number
  source_fingerprint: string
  source_captured_at: string
  error_code: string | null
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

export interface PublicationDraftArtifact extends SessionAiArtifactBase {
  kind: 'publication_draft'
  pulse_id: null
  source_analysis_id: null
  concept_index: null
  result: PublicationDraftArtifactResult | null
}

export interface MicroInterventionArtifact extends SessionAiArtifactBase {
  kind: 'micro_intervention'
  pulse_id: string
  source_analysis_id: string
  concept_index: number
  result: MicroInterventionResult | null
}

export type SessionAiArtifact = PublicationDraftArtifact | MicroInterventionArtifact

export interface SessionAiArtifactInvocation {
  artifact: SessionAiArtifact
  cached: boolean
  in_progress?: boolean
}
