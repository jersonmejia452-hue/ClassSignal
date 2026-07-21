export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      courses: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          professor_id: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          professor_id?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          professor_id?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      responses: {
        Row: {
          anonymous_id: string;
          created_at: string;
          id: string;
          is_visible_to_students: boolean;
          pulse_id: string;
          question_text: string | null;
          session_id: string;
          status: string;
        };
        Insert: {
          anonymous_id: string;
          created_at?: string;
          id?: string;
          is_visible_to_students?: boolean;
          pulse_id: string;
          question_text?: string | null;
          session_id: string;
          status: string;
        };
        Update: {
          anonymous_id?: string;
          created_at?: string;
          id?: string;
          is_visible_to_students?: boolean;
          pulse_id?: string;
          question_text?: string | null;
          session_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "responses_pulse_session_fkey";
            columns: ["pulse_id", "session_id"];
            isOneToOne: false;
            referencedRelation: "session_pulses";
            referencedColumns: ["id", "session_id"];
          },
          {
            foreignKeyName: "responses_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      session_analyses: {
        Row: {
          cached_input_tokens: number | null;
          completed_at: string | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          estimated_cost_usd: number | null;
          id: string;
          input_tokens: number | null;
          model: string;
          output_tokens: number | null;
          pricing_version: string | null;
          professor_id: string;
          pulse_id: string;
          prompt_version: number;
          provider_request_id: string | null;
          provider_response_id: string | null;
          reasoning_tokens: number | null;
          response_count: number;
          result: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status: string;
          total_tokens: number | null;
        };
        Insert: {
          cached_input_tokens?: number | null;
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          input_tokens?: number | null;
          model: string;
          output_tokens?: number | null;
          pricing_version?: string | null;
          professor_id: string;
          pulse_id: string;
          prompt_version: number;
          provider_request_id?: string | null;
          provider_response_id?: string | null;
          reasoning_tokens?: number | null;
          response_count: number;
          result?: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status?: string;
          total_tokens?: number | null;
        };
        Update: {
          cached_input_tokens?: number | null;
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          input_tokens?: number | null;
          model?: string;
          output_tokens?: number | null;
          pricing_version?: string | null;
          professor_id?: string;
          pulse_id?: string;
          prompt_version?: number;
          provider_request_id?: string | null;
          provider_response_id?: string | null;
          reasoning_tokens?: number | null;
          response_count?: number;
          result?: Json | null;
          session_id?: string;
          source_fingerprint?: string;
          source_latest_response_at?: string;
          status?: string;
          total_tokens?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_analyses_pulse_session_fkey";
            columns: ["pulse_id", "session_id"];
            isOneToOne: false;
            referencedRelation: "session_pulses";
            referencedColumns: ["id", "session_id"];
          },
          {
            foreignKeyName: "session_analyses_session_owner_fkey";
            columns: ["session_id", "professor_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "professor_id"];
          },
        ];
      };
      session_pulses: {
        Row: {
          ended_at: string | null;
          id: string;
          is_active: boolean;
          ordinal: number;
          questions_visible_to_students: boolean;
          session_id: string;
          started_at: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          is_active?: boolean;
          ordinal: number;
          questions_visible_to_students?: boolean;
          session_id: string;
          started_at?: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          is_active?: boolean;
          ordinal?: number;
          questions_visible_to_students?: boolean;
          session_id?: string;
          started_at?: string;
        };
        Relationships: [{
          foreignKeyName: "session_pulses_session_id_fkey";
          columns: ["session_id"];
          isOneToOne: false;
          referencedRelation: "sessions";
          referencedColumns: ["id"];
        }];
      };
      sessions: {
        Row: {
          code: string;
          course_id: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          is_active: boolean;
          professor_id: string;
          questions_visible_to_students: boolean;
          subject: string;
          title: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          course_id?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          is_active?: boolean;
          professor_id?: string;
          questions_visible_to_students?: boolean;
          subject: string;
          title: string;
          topic: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          course_id?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          is_active?: boolean;
          professor_id?: string;
          questions_visible_to_students?: boolean;
          subject?: string;
          title?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [{
          foreignKeyName: "sessions_course_owner_fkey";
          columns: ["course_id", "professor_id"];
          isOneToOne: false;
          referencedRelation: "courses";
          referencedColumns: ["id", "professor_id"];
        }];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_session_analysis: {
        Args: {
          p_hourly_limit: number;
          p_model: string;
          p_professor_id: string;
          p_pulse_id: string;
          p_prompt_version: number;
          p_response_count: number;
          p_session_id: string;
          p_source_fingerprint: string;
          p_source_latest_response_at: string;
        };
        Returns: {
          cached_input_tokens: number | null;
          completed_at: string | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          estimated_cost_usd: number | null;
          id: string;
          input_tokens: number | null;
          model: string;
          output_tokens: number | null;
          pricing_version: string | null;
          professor_id: string;
          pulse_id: string;
          prompt_version: number;
          provider_request_id: string | null;
          provider_response_id: string | null;
          reasoning_tokens: number | null;
          response_count: number;
          result: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status: string;
          total_tokens: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "session_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finalize_session_analysis: {
        Args: {
          p_analysis_id: string;
          p_error_message: string | null;
          p_professor_id: string;
          p_result: Json | null;
          p_status: string;
          p_telemetry: Json | null;
        };
        Returns: {
          cached_input_tokens: number | null;
          completed_at: string | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          estimated_cost_usd: number | null;
          id: string;
          input_tokens: number | null;
          model: string;
          output_tokens: number | null;
          pricing_version: string | null;
          professor_id: string;
          pulse_id: string;
          prompt_version: number;
          provider_request_id: string | null;
          provider_response_id: string | null;
          reasoning_tokens: number | null;
          response_count: number;
          result: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status: string;
          total_tokens: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "session_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_public_session: {
        Args: { p_code: string };
        Returns: {
          active_pulse_id: string | null;
          active_pulse_ordinal: number | null;
          active_pulse_started_at: string | null;
          code: string;
          id: string;
          is_active: boolean;
          subject: string;
          title: string;
          topic: string;
        };
      };
      get_student_question_wall: {
        Args: {
          p_limit?: number;
          p_pulse_id: string;
          p_session_id: string;
        };
        Returns: Json;
      };
      open_next_session_pulse: {
        Args: { p_session_id: string };
        Returns: {
          ended_at: string | null;
          id: string;
          is_active: boolean;
          ordinal: number;
          questions_visible_to_students: boolean;
          session_id: string;
          started_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "session_pulses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_session_active: {
        Args: {
          p_is_active: boolean;
          p_session_id: string;
        };
        Returns: {
          code: string;
          course_id: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          is_active: boolean;
          professor_id: string;
          questions_visible_to_students: boolean;
          subject: string;
          title: string;
          topic: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_student_response_server_v2: {
        Args: {
          p_anonymous_id: string;
          p_network_fingerprint: string;
          p_pulse_id: string;
          p_question_text: string | null;
          p_session_id: string;
          p_status: string;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
