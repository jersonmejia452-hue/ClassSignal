import { describe, expect, it } from "vitest";

import {
  completedAnalysisFinalization,
  failedAnalysisFinalization,
} from "./analysis-finalization.ts";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";
const PROFESSOR_ID = "22222222-2222-4222-8222-222222222222";

describe("analysis finalization RPC arguments", () => {
  it("separa resultado y telemetría al completar", () => {
    expect(completedAnalysisFinalization(
      ANALYSIS_ID,
      PROFESSOR_ID,
      { overview: "Mapa colectivo" },
      { input_tokens: 120, pricing_version: "test" },
    )).toEqual({
      p_analysis_id: ANALYSIS_ID,
      p_professor_id: PROFESSOR_ID,
      p_status: "completed",
      p_result: { overview: "Mapa colectivo" },
      p_error_message: null,
      p_telemetry: { input_tokens: 120, pricing_version: "test" },
    });
  });

  it("falla sin resultado, limita el error y conserva telemetría", () => {
    const args = failedAnalysisFinalization(
      ANALYSIS_ID,
      PROFESSOR_ID,
      "x".repeat(600),
      { duration_ms: 42 },
    );

    expect(args.p_status).toBe("failed");
    expect(args.p_result).toBeNull();
    expect(args.p_error_message).toHaveLength(500);
    expect(args.p_telemetry).toEqual({ duration_ms: 42 });
  });

  it("envía un objeto de telemetría vacío cuando no hubo proveedor", () => {
    expect(failedAnalysisFinalization(
      ANALYSIS_ID,
      PROFESSOR_ID,
      "Error controlado",
      null,
    ).p_telemetry).toEqual({});
  });
});
