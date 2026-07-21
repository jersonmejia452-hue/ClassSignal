import { withSupabase } from "@supabase/server";

import {
  buildMicroInterventionSource,
  buildPublicationSource,
  buildPulseAggregates,
  createSourceFingerprint,
  isAnalysisCurrent,
  MAX_PULSES,
  MAX_RESPONSES_PER_PULSE,
  parseArtifactRequestBody,
  projectConfusionMap,
  readArtifactRequestBody,
} from "./artifact-core.ts";
import {
  type ArtifactReservation,
  resolveArtifactReservation,
} from "./artifact-reservation.ts";
import type { Database, Json, SessionAiArtifactRow } from "./database.types.ts";
import {
  getDatabaseErrorMessage,
  getErrorCode,
  isRecord,
  PublicFunctionError,
} from "./errors.ts";
import { requestArtifact } from "./openai.ts";
import { readArtifactConfiguration, readOpenAIKey } from "./runtime-config.ts";
import type {
  ArtifactSource,
  ArtifactTelemetry,
  PulseAggregate,
  UnderstandingStatus,
} from "./types.ts";

const ARTIFACTS_PER_HOUR = 12;
const PENDING_ARTIFACT_TIMEOUT_MS = 10 * 60 * 1_000;

interface SessionRow {
  id: string;
  professor_id: string;
  title: string;
  subject: string;
  topic: string;
}

interface PulseRow {
  id: string;
  session_id: string;
  ordinal: number;
}

interface ResponseRow {
  pulse_id: string;
  status: UnderstandingStatus;
  created_at: string;
}

interface AnalysisRow {
  id: string;
  pulse_id: string;
  response_count: number;
  source_latest_response_at: string;
  result: unknown;
  created_at: string;
  completed_at: string | null;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function errorResponse(error: PublicFunctionError) {
  return jsonResponse(
    { error: { code: error.code, message: error.message } },
    error.status,
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function isUnderstandingStatus(value: unknown): value is UnderstandingStatus {
  return value === "understood" || value === "question" || value === "lost";
}

function parseArtifactRow(value: unknown): SessionAiArtifactRow {
  if (
    !isRecord(value) || !isUuid(value.id) || !isUuid(value.session_id) ||
    !isUuid(value.professor_id) ||
    (value.pulse_id !== null && !isUuid(value.pulse_id)) ||
    (value.source_analysis_id !== null && !isUuid(value.source_analysis_id)) ||
    (value.kind !== "publication_draft" &&
      value.kind !== "micro_intervention") ||
    (value.status !== "pending" && value.status !== "completed" &&
      value.status !== "failed") ||
    typeof value.source_fingerprint !== "string" ||
    typeof value.source_captured_at !== "string" ||
    !Number.isFinite(Date.parse(value.source_captured_at))
  ) {
    throw new Error("Artifact RPC returned an invalid row");
  }
  return value as unknown as SessionAiArtifactRow;
}

function parseArtifactRpcResult(value: unknown): {
  outcome: ArtifactReservation<SessionAiArtifactRow>["outcome"];
  artifact: SessionAiArtifactRow;
} {
  if (
    !isRecord(value) ||
    (value.outcome !== "created" && value.outcome !== "cached" &&
      value.outcome !== "in_progress")
  ) throw new Error("Artifact RPC returned an invalid outcome");
  return {
    outcome: value.outcome,
    artifact: parseArtifactRow(value.artifact),
  };
}

function mapArtifactRpcError(error: unknown): PublicFunctionError | null {
  const code = getErrorCode(error);
  const message = getDatabaseErrorMessage(error);
  if (
    code === "P0001" &&
    [
      "artifact_global_limit",
      "artifact_daily_limit",
      "artifact_hourly_limit",
    ].includes(message ?? "")
  ) {
    const isGlobal = message === "artifact_global_limit";
    const isDaily = message === "artifact_daily_limit";
    return new PublicFunctionError(
      429,
      message ?? "artifact_hourly_limit",
      isGlobal
        ? "ClassSignal alcanzó el presupuesto diario de IA. Intenta mañana."
        : isDaily
        ? "Alcanzaste el límite diario de IA. Intenta mañana."
        : "Alcanzaste el límite temporal de IA. Intenta más tarde.",
    );
  }
  if (code === "42501" && message === "professor_role_required") {
    return new PublicFunctionError(
      403,
      "professor_role_required",
      "Esta acción requiere una cuenta de profesor.",
    );
  }
  if (code === "P0001" && message === "session_not_found") {
    return new PublicFunctionError(
      404,
      "session_not_found",
      "No encontramos esta clase o no te pertenece.",
    );
  }
  if (code === "P0001" && message === "pulse_not_found") {
    return new PublicFunctionError(
      404,
      "pulse_not_found",
      "No encontramos este pulso o no te pertenece.",
    );
  }
  if (code === "P0001" && message === "source_analysis_not_found") {
    return new PublicFunctionError(
      409,
      "analysis_outdated",
      "El mapa seleccionado cambió. Actualízalo antes de preparar la intervención.",
    );
  }
  if (code === "23505") {
    return new PublicFunctionError(
      409,
      "artifact_in_progress",
      "Ya hay una generación en curso para este objetivo.",
    );
  }
  return null;
}

function latestAnalysisForPulse(
  analyses: AnalysisRow[],
  pulseId: string,
) {
  return analyses.find((analysis) => analysis.pulse_id === pulseId) ?? null;
}

function aggregateForPulse(
  aggregates: PulseAggregate[],
  pulse: PulseRow,
) {
  return aggregates.find((aggregate) => aggregate.ordinal === pulse.ordinal) ??
    null;
}

const generateSessionArtifact = withSupabase<Database>(
  { auth: "user" },
  async (request, context) => {
    if (request.method !== "POST") {
      return errorResponse(
        new PublicFunctionError(
          405,
          "method_not_allowed",
          "Usa una solicitud POST para generar una orientación.",
        ),
      );
    }

    const professorId = context.userClaims?.id ?? context.jwtClaims?.sub ??
      null;
    if (!isUuid(professorId)) {
      return errorResponse(
        new PublicFunctionError(
          401,
          "unauthorized",
          "Debes iniciar sesión como profesor.",
        ),
      );
    }

    let artifactId: string | null = null;
    let artifactTelemetry: ArtifactTelemetry | null = null;

    try {
      // Postgres clamps this request-start boundary conservatively to its own
      // clock before persisting it with the immutable artifact.
      const sourceCapturedAt = new Date().toISOString();
      const contentType = request.headers.get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();
      if (contentType !== "application/json") {
        throw new PublicFunctionError(
          415,
          "unsupported_media_type",
          "La solicitud debe usar contenido JSON.",
        );
      }

      const artifactRequest = parseArtifactRequestBody(
        await readArtifactRequestBody(request),
      );
      const configuration = readArtifactConfiguration(artifactRequest.kind);

      const { data: profile, error: profileError } = await context.supabase
        .from("profiles")
        .select("role")
        .eq("id", professorId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role !== "professor") {
        throw new PublicFunctionError(
          403,
          "professor_role_required",
          "Esta acción requiere una cuenta de profesor.",
        );
      }

      const { data: sessionData, error: sessionError } = await context.supabase
        .from("sessions")
        .select("id, professor_id, title, subject, topic")
        .eq("id", artifactRequest.sessionId)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!sessionData || sessionData.professor_id !== professorId) {
        throw new PublicFunctionError(
          404,
          "session_not_found",
          "No encontramos esta clase o no te pertenece.",
        );
      }
      const session = sessionData as SessionRow;

      const { data: pulseData, error: pulseError } = await context.supabase
        .from("session_pulses")
        .select("id, session_id, ordinal")
        .eq("session_id", session.id)
        .order("ordinal", { ascending: true })
        .limit(MAX_PULSES);
      if (pulseError) throw pulseError;
      const pulses = ((pulseData ?? []) as unknown[]).filter(
        (pulse): pulse is PulseRow =>
          isRecord(pulse) && isUuid(pulse.id) &&
          pulse.session_id === session.id &&
          Number.isSafeInteger(pulse.ordinal) &&
          (pulse.ordinal as number) >= 1 &&
          (pulse.ordinal as number) <= MAX_PULSES,
      );
      if (pulses.length === 0) {
        throw new PublicFunctionError(
          422,
          "insufficient_session_data",
          "La clase aún no tiene pulsos suficientes para generar una orientación.",
        );
      }

      if (
        artifactRequest.kind === "micro_intervention" &&
        !pulses.some((pulse) => pulse.id === artifactRequest.pulseId)
      ) {
        throw new PublicFunctionError(
          404,
          "pulse_not_found",
          "No encontramos este pulso o no te pertenece.",
        );
      }

      // Privacy boundary: this projection deliberately excludes response id,
      // anonymous_id and question_text. Queries are bounded by the DB's 500
      // responses-per-pulse invariant.
      const responseGroups = await Promise.all(pulses.map(async (pulse) => {
        const { data, error } = await context.supabase
          .from("responses")
          .select("pulse_id, status, created_at")
          .eq("session_id", session.id)
          .eq("pulse_id", pulse.id)
          .order("created_at", { ascending: false })
          .limit(MAX_RESPONSES_PER_PULSE);
        if (error) throw error;
        return ((data ?? []) as unknown[]).map((response): ResponseRow => {
          if (
            !isRecord(response) ||
            response.pulse_id !== pulse.id ||
            !isUnderstandingStatus(response.status) ||
            typeof response.created_at !== "string" ||
            !Number.isFinite(Date.parse(response.created_at))
          ) throw new Error("Invalid response aggregate source");
          return {
            pulse_id: response.pulse_id,
            status: response.status,
            created_at: response.created_at,
          };
        });
      }));
      const responses = responseGroups.flat();
      const aggregates = buildPulseAggregates(pulses, responses);
      if (aggregates.every((pulse) => pulse.response_count === 0)) {
        throw new PublicFunctionError(
          422,
          "insufficient_session_data",
          "Se necesita al menos una respuesta colectiva para generar una orientación.",
        );
      }

      // Fetch one latest completed map per pulse so a long history on one
      // pulse can never displace another pulse's current map.
      const analysisGroups = await Promise.all(pulses.map(async (pulse) => {
        const { data, error } = await context.supabase
          .from("session_analyses")
          .select(
            "id, pulse_id, response_count, source_latest_response_at, result, created_at, completed_at",
          )
          .eq("session_id", session.id)
          .eq("pulse_id", pulse.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        return data ?? [];
      }));
      const analyses = (analysisGroups.flat() as unknown[]).filter(
        (analysis): analysis is AnalysisRow =>
          isRecord(analysis) && isUuid(analysis.id) &&
          isUuid(analysis.pulse_id) &&
          Number.isSafeInteger(analysis.response_count) &&
          (analysis.response_count as number) > 0 &&
          typeof analysis.source_latest_response_at === "string" &&
          typeof analysis.created_at === "string",
      );

      let source: ArtifactSource;
      let sourceAnalysisId: string | null = null;
      let pulseId: string | null = null;
      let conceptIndex: number | null = null;

      if (artifactRequest.kind === "publication_draft") {
        const maps: Array<{
          pulse_ordinal: number;
          map: NonNullable<ReturnType<typeof projectConfusionMap>>;
        }> = [];
        for (const pulse of pulses) {
          const aggregate = aggregateForPulse(aggregates, pulse);
          const analysis = latestAnalysisForPulse(analyses, pulse.id);
          if (
            !aggregate || !analysis || !isAnalysisCurrent(analysis, aggregate)
          ) {
            continue;
          }
          const map = projectConfusionMap(analysis.result);
          if (map) maps.push({ pulse_ordinal: pulse.ordinal, map });
        }
        source = buildPublicationSource({ session, pulses: aggregates, maps });
      } else {
        const pulse = pulses.find((item) =>
          item.id === artifactRequest.pulseId
        )!;
        const aggregate = aggregateForPulse(aggregates, pulse);
        const analysis = latestAnalysisForPulse(analyses, pulse.id);
        if (!analysis) {
          throw new PublicFunctionError(
            422,
            "analysis_required",
            "Genera primero un mapa de confusión para este pulso.",
          );
        }
        if (!aggregate || !isAnalysisCurrent(analysis, aggregate)) {
          throw new PublicFunctionError(
            409,
            "analysis_outdated",
            "El mapa está desactualizado. Actualízalo antes de preparar la intervención.",
          );
        }
        const map = projectConfusionMap(analysis.result);
        if (!map) {
          throw new PublicFunctionError(
            422,
            "analysis_unavailable",
            "El mapa no contiene un resultado utilizable. Genéralo nuevamente.",
          );
        }
        source = buildMicroInterventionSource({
          session,
          pulse: aggregate,
          map,
          conceptIndex: artifactRequest.conceptIndex,
        });
        sourceAnalysisId = analysis.id;
        pulseId = pulse.id;
        conceptIndex = artifactRequest.conceptIndex;
      }

      const sourceFingerprint = await createSourceFingerprint(source);
      const findReusable = async (): Promise<
        ArtifactReservation<SessionAiArtifactRow> | null
      > => {
        if (!artifactRequest.regenerate) {
          let cachedQuery = context.supabase
            .from("session_ai_artifacts")
            .select("*")
            .eq("session_id", session.id)
            .eq("professor_id", professorId)
            .eq("kind", artifactRequest.kind)
            .eq("status", "completed")
            .eq("model", configuration.model)
            .eq("reasoning_effort", configuration.reasoningEffort)
            .eq("prompt_version", configuration.promptVersion)
            .eq("source_fingerprint", sourceFingerprint);
          cachedQuery = pulseId === null
            ? cachedQuery.is("pulse_id", null)
            : cachedQuery.eq("pulse_id", pulseId);
          cachedQuery = sourceAnalysisId === null
            ? cachedQuery.is("source_analysis_id", null)
            : cachedQuery.eq("source_analysis_id", sourceAnalysisId);
          cachedQuery = conceptIndex === null
            ? cachedQuery.is("concept_index", null)
            : cachedQuery.eq("concept_index", conceptIndex);

          const { data, error } = await cachedQuery
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (data) {
            return { outcome: "cached", artifact: parseArtifactRow(data) };
          }
        }

        let pendingQuery = context.supabase
          .from("session_ai_artifacts")
          .select("*")
          .eq("session_id", session.id)
          .eq("professor_id", professorId)
          .eq("kind", artifactRequest.kind)
          .eq("status", "pending")
          .gt(
            "created_at",
            new Date(Date.now() - PENDING_ARTIFACT_TIMEOUT_MS).toISOString(),
          );
        pendingQuery = pulseId === null
          ? pendingQuery.is("pulse_id", null)
          : pendingQuery.eq("pulse_id", pulseId);
        pendingQuery = sourceAnalysisId === null
          ? pendingQuery.is("source_analysis_id", null)
          : pendingQuery.eq("source_analysis_id", sourceAnalysisId);
        pendingQuery = conceptIndex === null
          ? pendingQuery.is("concept_index", null)
          : pendingQuery.eq("concept_index", conceptIndex);

        const { data, error } = await pendingQuery
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data
          ? { outcome: "in_progress", artifact: parseArtifactRow(data) }
          : null;
      };

      const { reservation, providerKey } = await resolveArtifactReservation({
        findReusable,
        readProviderKey: readOpenAIKey,
        reservePaidWork: async () => {
          const { data, error } = await context.supabaseAdmin.rpc(
            "create_session_ai_artifact",
            {
              p_session_id: session.id,
              p_pulse_id: pulseId,
              p_professor_id: professorId,
              p_kind: artifactRequest.kind,
              p_model: configuration.model,
              p_reasoning_effort: configuration.reasoningEffort,
              p_prompt_version: configuration.promptVersion,
              p_source_fingerprint: sourceFingerprint,
              p_source_analysis_id: sourceAnalysisId,
              p_concept_index: conceptIndex,
              p_force_regenerate: artifactRequest.regenerate,
              p_hourly_limit: ARTIFACTS_PER_HOUR,
              p_source_captured_at: sourceCapturedAt,
            },
          );
          if (error) throw mapArtifactRpcError(error) ?? error;
          return parseArtifactRpcResult(data);
        },
      });

      if (reservation.outcome === "cached") {
        return jsonResponse({ artifact: reservation.artifact, cached: true });
      }
      if (reservation.outcome === "in_progress") {
        return jsonResponse(
          {
            artifact: reservation.artifact,
            cached: false,
            in_progress: true,
          },
          202,
        );
      }

      artifactId = reservation.artifact.id;
      if (!providerKey) {
        throw new Error("Created artifact reservation is missing provider key");
      }
      const { result, telemetry } = await requestArtifact(
        providerKey,
        source,
        configuration,
      );
      artifactTelemetry = telemetry;

      const { data: completedArtifact, error: completionError } = await context
        .supabaseAdmin.rpc("finalize_session_ai_artifact", {
          p_artifact_id: artifactId,
          p_professor_id: professorId,
          p_status: "completed",
          p_result: result as unknown as Json,
          p_error_code: null,
          p_error_message: null,
          p_telemetry: telemetry as unknown as Json,
        });
      if (completionError) throw completionError;
      artifactId = null;
      return jsonResponse({
        artifact: parseArtifactRow(completedArtifact),
        cached: false,
      });
    } catch (error) {
      const publicError = error instanceof PublicFunctionError
        ? error
        : new PublicFunctionError(
          500,
          "artifact_generation_failed",
          "No pudimos completar la generación. Intenta nuevamente.",
        );

      if (artifactId) {
        const failureTelemetry = publicError.telemetry ?? artifactTelemetry ??
          {};
        const { error: failureUpdateError } = await context.supabaseAdmin.rpc(
          "finalize_session_ai_artifact",
          {
            p_artifact_id: artifactId,
            p_professor_id: professorId,
            p_status: "failed",
            p_result: null,
            p_error_code: publicError.code.slice(0, 64),
            p_error_message: publicError.message.slice(0, 500),
            p_telemetry: failureTelemetry as unknown as Json,
          },
        );
        if (failureUpdateError) {
          console.error(
            "Could not close failed session AI artifact",
            failureUpdateError.code,
          );
        }
      }

      if (!(error instanceof PublicFunctionError)) {
        console.error(
          "Unexpected generate-session-artifact failure",
          getErrorCode(error) ?? "unknown",
        );
      }
      return errorResponse(publicError);
    }
  },
);

export default { fetch: generateSessionArtifact };
