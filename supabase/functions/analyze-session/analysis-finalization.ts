import type { Json } from "./database.types.ts";

export interface FinalizeSessionAnalysisArgs {
  p_analysis_id: string;
  p_professor_id: string;
  p_status: "completed" | "failed";
  p_result: Json | null;
  p_error_message: string | null;
  p_telemetry: Json;
}

export function completedAnalysisFinalization(
  analysisId: string,
  professorId: string,
  result: Json,
  telemetry: Json,
): FinalizeSessionAnalysisArgs {
  return {
    p_analysis_id: analysisId,
    p_professor_id: professorId,
    p_status: "completed",
    p_result: result,
    p_error_message: null,
    p_telemetry: telemetry,
  };
}

export function failedAnalysisFinalization(
  analysisId: string,
  professorId: string,
  errorMessage: string,
  telemetry: Json | null,
): FinalizeSessionAnalysisArgs {
  return {
    p_analysis_id: analysisId,
    p_professor_id: professorId,
    p_status: "failed",
    p_result: null,
    p_error_message: errorMessage.slice(0, 500),
    p_telemetry: telemetry ?? {},
  };
}
