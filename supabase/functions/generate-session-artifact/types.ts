export type ArtifactKind = "publication_draft" | "micro_intervention";
export type ReasoningEffort = "medium" | "high";
export type UnderstandingStatus = "understood" | "question" | "lost";

export interface PublicationDraftRequest {
  sessionId: string;
  kind: "publication_draft";
  regenerate: boolean;
}

export interface MicroInterventionRequest {
  sessionId: string;
  kind: "micro_intervention";
  pulseId: string;
  conceptIndex: number;
  regenerate: boolean;
}

export type ArtifactRequest =
  | PublicationDraftRequest
  | MicroInterventionRequest;

export interface ArtifactTelemetry {
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  pricing_version: string;
  duration_ms: number;
  provider_request_id: string | null;
  provider_response_id: string | null;
}

export interface StatusMetric {
  count: number;
  percentage: number;
}

export interface PulseAggregate {
  ordinal: number;
  response_count: number;
  understood: StatusMetric;
  question: StatusMetric;
  lost: StatusMetric;
  /** Server-only staleness metadata. Never serialize this field to OpenAI. */
  latest_response_at: string | null;
}

export interface PulseDelta {
  from_pulse: number;
  to_pulse: number;
  from_response_count: number;
  to_response_count: number;
  understood_percentage_points: number;
  question_percentage_points: number;
  lost_percentage_points: number;
}

export interface ProjectedConcept {
  concept: string;
  explanation: string;
  severity: "low" | "medium" | "high";
  affected_signals: number;
}

export interface ProjectedRecommendation {
  title: string;
  action: string;
  priority: "now" | "next" | "later";
}

export interface ProjectedConfusionMap {
  overview: string;
  confusion_level: "low" | "medium" | "high" | "critical";
  concepts: ProjectedConcept[];
  recommendations: ProjectedRecommendation[];
}

export interface PublicationSource {
  kind: "publication_draft";
  class_context: {
    title: string;
    subject: string;
    topic: string;
  };
  pulses: Array<Omit<PulseAggregate, "latest_response_at">>;
  comparisons: PulseDelta[];
  confusion_maps: Array<{
    pulse_ordinal: number;
    map: ProjectedConfusionMap;
  }>;
}

export interface MicroInterventionSource {
  kind: "micro_intervention";
  class_context: {
    title: string;
    subject: string;
    topic: string;
  };
  pulse: Omit<PulseAggregate, "latest_response_at">;
  confusion_context: {
    overview: string;
    confusion_level: "low" | "medium" | "high" | "critical";
    concept: ProjectedConcept;
    recommendations: ProjectedRecommendation[];
  };
}

export type ArtifactSource = PublicationSource | MicroInterventionSource;

export interface PublicationDraftResult {
  summary: string;
  resources_and_next_steps: string;
  review_notes: Array<{
    field: "summary" | "resources";
    message: string;
  }>;
}

export interface MicroInterventionResult {
  title: string;
  objective: string;
  duration_minutes: number;
  explanation: string;
  example: string;
  steps: Array<{
    instruction: string;
    duration_minutes: number;
  }>;
  check_question: string;
  expected_answer: string;
  misconception_to_watch: string;
  follow_up_action: string;
}

export type ArtifactResult = PublicationDraftResult | MicroInterventionResult;

export interface ArtifactConfiguration {
  model: "gpt-5.6-luna";
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  promptVersion: number;
}
