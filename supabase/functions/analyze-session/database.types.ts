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
      responses: {
        Row: {
          anonymous_id: string;
          created_at: string;
          id: string;
          question_text: string | null;
          session_id: string;
          status: string;
        };
        Insert: {
          anonymous_id: string;
          created_at?: string;
          id?: string;
          question_text?: string | null;
          session_id: string;
          status: string;
        };
        Update: {
          anonymous_id?: string;
          created_at?: string;
          id?: string;
          question_text?: string | null;
          session_id?: string;
          status?: string;
        };
        Relationships: [{
          foreignKeyName: "responses_session_id_fkey";
          columns: ["session_id"];
          isOneToOne: false;
          referencedRelation: "sessions";
          referencedColumns: ["id"];
        }];
      };
      session_analyses: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          model: string;
          professor_id: string;
          prompt_version: number;
          response_count: number;
          result: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          model: string;
          professor_id: string;
          prompt_version: number;
          response_count: number;
          result?: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          model?: string;
          professor_id?: string;
          prompt_version?: number;
          response_count?: number;
          result?: Json | null;
          session_id?: string;
          source_fingerprint?: string;
          source_latest_response_at?: string;
          status?: string;
        };
        Relationships: [{
          foreignKeyName: "session_analyses_session_owner_fkey";
          columns: ["session_id", "professor_id"];
          isOneToOne: false;
          referencedRelation: "sessions";
          referencedColumns: ["id", "professor_id"];
        }];
      };
      sessions: {
        Row: {
          code: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          is_active: boolean;
          professor_id: string;
          subject: string;
          title: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          is_active?: boolean;
          professor_id?: string;
          subject: string;
          title: string;
          topic: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          is_active?: boolean;
          professor_id?: string;
          subject?: string;
          title?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_session_analysis: {
        Args: {
          p_hourly_limit: number;
          p_model: string;
          p_professor_id: string;
          p_prompt_version: number;
          p_response_count: number;
          p_session_id: string;
          p_source_fingerprint: string;
          p_source_latest_response_at: string;
        };
        Returns: {
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          model: string;
          professor_id: string;
          prompt_version: number;
          response_count: number;
          result: Json | null;
          session_id: string;
          source_fingerprint: string;
          source_latest_response_at: string;
          status: string;
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
          code: string;
          id: string;
          is_active: boolean;
          subject: string;
          title: string;
          topic: string;
        };
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
