export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type SessionAiArtifactRow = {
  id: string;
  professor_id: string;
  session_id: string;
  pulse_id: string | null;
  source_analysis_id: string | null;
  concept_index: number | null;
  kind: string;
  status: string;
  model: string;
  reasoning_effort: string;
  prompt_version: number;
  source_fingerprint: string;
  source_captured_at: string;
  result: Json | null;
  error_code: string | null;
  error_message: string | null;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  pricing_version: string | null;
  duration_ms: number | null;
  provider_request_id: string | null;
  provider_response_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      profiles: TableDefinition<{
        id: string;
        role: string;
      }>;
      sessions: TableDefinition<{
        id: string;
        professor_id: string;
        title: string;
        subject: string;
        topic: string;
      }>;
      session_pulses: TableDefinition<{
        id: string;
        session_id: string;
        ordinal: number;
      }>;
      responses: TableDefinition<{
        session_id: string;
        pulse_id: string;
        status: string;
        created_at: string;
      }>;
      session_analyses: TableDefinition<{
        id: string;
        session_id: string;
        pulse_id: string;
        status: string;
        response_count: number;
        source_latest_response_at: string;
        result: Json | null;
        created_at: string;
        completed_at: string | null;
      }>;
      session_ai_artifacts: TableDefinition<SessionAiArtifactRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_session_ai_artifact: {
        Args: {
          p_session_id: string;
          p_pulse_id: string | null;
          p_professor_id: string;
          p_kind: string;
          p_model: string;
          p_reasoning_effort: string;
          p_prompt_version: number;
          p_source_fingerprint: string;
          p_source_analysis_id: string | null;
          p_concept_index: number | null;
          p_force_regenerate: boolean;
          p_hourly_limit: number;
          p_source_captured_at?: string;
        };
        Returns: Json;
      };
      finalize_session_ai_artifact: {
        Args: {
          p_artifact_id: string;
          p_professor_id: string;
          p_status: "completed" | "failed";
          p_result: Json | null;
          p_error_code: string | null;
          p_error_message: string | null;
          p_telemetry: Json;
        };
        Returns: SessionAiArtifactRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
