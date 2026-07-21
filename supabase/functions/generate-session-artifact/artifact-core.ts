import { boundedText, isRecord, PublicFunctionError } from "./errors.ts";
import type {
  ArtifactKind,
  ArtifactRequest,
  ArtifactResult,
  ArtifactSource,
  MicroInterventionResult,
  MicroInterventionSource,
  ProjectedConfusionMap,
  PublicationDraftResult,
  PublicationSource,
  PulseAggregate,
  PulseDelta,
  UnderstandingStatus,
} from "./types.ts";

export const MAX_ARTIFACT_BODY_BYTES = 4_096;
export const ARTIFACT_PROMPT_VERSION = 1;
export const MAX_PULSES = 6;
export const MAX_RESPONSES_PER_PULSE = 500;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REPLACEMENT_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const UUID_REPLACEMENT_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const URL_REPLACEMENT_PATTERN =
  /\b(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|co|ai|app|dev)(?:\/[^\s<>()]*)?)/gi;
const SECRET_REPLACEMENT_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/gi;
const PHONE_REPLACEMENT_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)|\d{2,3})[\s.-]\d{3}[\s.-]\d{4}\b/gi;

const EMAIL_DETECTION_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/i;
const UUID_DETECTION_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const URL_DETECTION_PATTERN =
  /\b(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|co|ai|app|dev)(?:\/[^\s<>()]*)?)/i;
const SECRET_DETECTION_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/i;
const PHONE_DETECTION_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)|\d{2,3})[\s.-]\d{3}[\s.-]\d{4}\b/i;

const FORBIDDEN_PROVIDER_KEYS = new Set([
  "id",
  "session_id",
  "pulse_id",
  "analysis_id",
  "source_analysis_id",
  "professor_id",
  "student_id",
  "anonymous_id",
  "response_id",
  "enrollment_id",
  "email",
  "evidence",
  "question_text",
  "created_at",
  "updated_at",
  "completed_at",
  "latest_response_at",
  "token",
]);

export interface PulseDescriptor {
  id: string;
  ordinal: number;
}

export interface ResponseSignal {
  pulse_id: string;
  status: UnderstandingStatus;
  created_at: string;
}

export interface AnalysisSnapshot {
  id: string;
  pulse_id: string;
  response_count: number;
  source_latest_response_at: string;
  result: unknown;
  created_at: string;
  completed_at: string | null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key));
}

function invalidRequest(code: string, message: string): never {
  throw new PublicFunctionError(400, code, message);
}

export function assertBodyByteLength(rawBody: string) {
  if (new TextEncoder().encode(rawBody).byteLength > MAX_ARTIFACT_BODY_BYTES) {
    throw new PublicFunctionError(
      413,
      "artifact_request_too_large",
      "La solicitud del artefacto es demasiado grande.",
    );
  }
}

export function parseArtifactRequestBody(rawBody: string): ArtifactRequest {
  assertBodyByteLength(rawBody);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    invalidRequest(
      "invalid_json",
      "La solicitud no contiene JSON válido.",
    );
  }

  if (!isRecord(body)) {
    invalidRequest(
      "invalid_artifact_request",
      "La solicitud del artefacto no es válida.",
    );
  }

  if (!isUuid(body.sessionId)) {
    invalidRequest("invalid_session_id", "La sesión solicitada no es válida.");
  }

  const regenerate = body.regenerate === undefined ? false : body.regenerate;
  if (typeof regenerate !== "boolean") {
    invalidRequest(
      "invalid_regenerate_flag",
      "La opción de regeneración no es válida.",
    );
  }

  if (body.kind === "publication_draft") {
    if (!hasOnlyKeys(body, ["sessionId", "kind", "regenerate"])) {
      invalidRequest(
        "unexpected_artifact_fields",
        "La solicitud contiene campos no permitidos.",
      );
    }
    return {
      sessionId: body.sessionId,
      kind: "publication_draft",
      regenerate,
    };
  }

  if (body.kind === "micro_intervention") {
    if (
      !hasOnlyKeys(body, [
        "sessionId",
        "kind",
        "pulseId",
        "conceptIndex",
        "regenerate",
      ])
    ) {
      invalidRequest(
        "unexpected_artifact_fields",
        "La solicitud contiene campos no permitidos.",
      );
    }
    if (!isUuid(body.pulseId)) {
      invalidRequest("invalid_pulse_id", "El pulso solicitado no es válido.");
    }
    if (
      !Number.isSafeInteger(body.conceptIndex) ||
      (body.conceptIndex as number) < 0 ||
      (body.conceptIndex as number) >= 10
    ) {
      invalidRequest(
        "invalid_concept_index",
        "El concepto solicitado no es válido.",
      );
    }
    return {
      sessionId: body.sessionId,
      kind: "micro_intervention",
      pulseId: body.pulseId,
      conceptIndex: body.conceptIndex as number,
      regenerate,
    };
  }

  invalidRequest(
    "invalid_artifact_kind",
    "El tipo de artefacto solicitado no es válido.",
  );
}

export function findForbiddenContent(value: string) {
  if (EMAIL_DETECTION_PATTERN.test(value)) return "email";
  if (UUID_DETECTION_PATTERN.test(value)) return "uuid";
  if (URL_DETECTION_PATTERN.test(value)) return "url";
  if (SECRET_DETECTION_PATTERN.test(value)) return "secret";
  if (PHONE_DETECTION_PATTERN.test(value)) return "phone";
  return null;
}

export function sanitizeUntrustedText(value: unknown, maxLength: number) {
  const text = boundedText(value, maxLength * 2);
  if (!text) return null;
  const redacted = text
    .replace(EMAIL_REPLACEMENT_PATTERN, "[correo omitido]")
    .replace(UUID_REPLACEMENT_PATTERN, "[identificador omitido]")
    .replace(URL_REPLACEMENT_PATTERN, "[enlace omitido]")
    .replace(SECRET_REPLACEMENT_PATTERN, "[secreto omitido]")
    .replace(PHONE_REPLACEMENT_PATTERN, "[teléfono omitido]")
    .replace(/\s+/g, " ")
    .trim();
  return redacted ? redacted.slice(0, maxLength) : null;
}

function roundOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function percentage(count: number, total: number) {
  return total === 0 ? 0 : roundOne((count / total) * 100);
}

export function buildPulseAggregates(
  pulses: PulseDescriptor[],
  responses: ResponseSignal[],
): PulseAggregate[] {
  const byPulse = new Map<string, ResponseSignal[]>();
  for (const pulse of pulses) byPulse.set(pulse.id, []);

  for (const response of responses) {
    const bucket = byPulse.get(response.pulse_id);
    if (bucket) bucket.push(response);
  }

  return [...pulses]
    .sort((first, second) => first.ordinal - second.ordinal)
    .map((pulse) => {
      const pulseResponses = byPulse.get(pulse.id) ?? [];
      const counts: Record<UnderstandingStatus, number> = {
        understood: 0,
        question: 0,
        lost: 0,
      };
      let latestResponseAt: string | null = null;

      for (const response of pulseResponses) {
        counts[response.status] += 1;
        if (
          latestResponseAt === null ||
          Date.parse(response.created_at) > Date.parse(latestResponseAt)
        ) {
          latestResponseAt = response.created_at;
        }
      }

      const total = pulseResponses.length;
      return {
        ordinal: pulse.ordinal,
        response_count: total,
        understood: {
          count: counts.understood,
          percentage: percentage(counts.understood, total),
        },
        question: {
          count: counts.question,
          percentage: percentage(counts.question, total),
        },
        lost: {
          count: counts.lost,
          percentage: percentage(counts.lost, total),
        },
        latest_response_at: latestResponseAt,
      };
    });
}

export function buildPulseDeltas(pulses: PulseAggregate[]): PulseDelta[] {
  const sorted = [...pulses].sort((first, second) =>
    first.ordinal - second.ordinal
  );
  const deltas: PulseDelta[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const before = sorted[index - 1];
    const after = sorted[index];
    if (!before || !after) continue;
    deltas.push({
      from_pulse: before.ordinal,
      to_pulse: after.ordinal,
      from_response_count: before.response_count,
      to_response_count: after.response_count,
      understood_percentage_points: roundOne(
        after.understood.percentage - before.understood.percentage,
      ),
      question_percentage_points: roundOne(
        after.question.percentage - before.question.percentage,
      ),
      lost_percentage_points: roundOne(
        after.lost.percentage - before.lost.percentage,
      ),
    });
  }
  return deltas;
}

function sameInstant(first: string, second: string | null) {
  if (!second) return false;
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  return Number.isFinite(firstTime) && firstTime === secondTime;
}

export function isAnalysisCurrent(
  analysis: Pick<
    AnalysisSnapshot,
    "response_count" | "source_latest_response_at"
  >,
  pulse: PulseAggregate,
) {
  return analysis.response_count === pulse.response_count &&
    sameInstant(analysis.source_latest_response_at, pulse.latest_response_at);
}

function isConfusionLevel(
  value: unknown,
): value is ProjectedConfusionMap["confusion_level"] {
  return value === "low" || value === "medium" || value === "high" ||
    value === "critical";
}

function isSeverity(
  value: unknown,
): value is ProjectedConfusionMap["concepts"][number]["severity"] {
  return value === "low" || value === "medium" || value === "high";
}

function isPriority(
  value: unknown,
): value is ProjectedConfusionMap["recommendations"][number]["priority"] {
  return value === "now" || value === "next" || value === "later";
}

/**
 * Projects an existing map onto the only fields new artifacts may use. In
 * particular, `concepts[].evidence` is deliberately never read or returned.
 */
export function projectConfusionMap(
  value: unknown,
): ProjectedConfusionMap | null {
  if (!isRecord(value)) return null;
  const overview = sanitizeUntrustedText(value.overview, 1_200);
  if (!overview || !isConfusionLevel(value.confusion_level)) return null;
  if (!Array.isArray(value.concepts) || !Array.isArray(value.recommendations)) {
    return null;
  }

  const concepts: ProjectedConfusionMap["concepts"] = [];
  for (const candidate of value.concepts.slice(0, 10)) {
    if (!isRecord(candidate)) return null;
    const concept = sanitizeUntrustedText(candidate.concept, 160);
    const explanation = sanitizeUntrustedText(candidate.explanation, 700);
    if (
      !concept || !explanation || !isSeverity(candidate.severity) ||
      !Number.isSafeInteger(candidate.affected_students) ||
      (candidate.affected_students as number) < 1 ||
      (candidate.affected_students as number) > MAX_RESPONSES_PER_PULSE
    ) return null;
    concepts.push({
      concept,
      explanation,
      severity: candidate.severity,
      affected_signals: candidate.affected_students as number,
    });
  }

  const recommendations: ProjectedConfusionMap["recommendations"] = [];
  for (const candidate of value.recommendations.slice(0, 8)) {
    if (!isRecord(candidate)) return null;
    const title = sanitizeUntrustedText(candidate.title, 160);
    const action = sanitizeUntrustedText(candidate.action, 700);
    if (!title || !action || !isPriority(candidate.priority)) return null;
    recommendations.push({ title, action, priority: candidate.priority });
  }

  return {
    overview,
    confusion_level: value.confusion_level,
    concepts,
    recommendations,
  };
}

function publicPulse(
  pulse: PulseAggregate,
): Omit<PulseAggregate, "latest_response_at"> {
  const { latest_response_at: _serverOnly, ...safePulse } = pulse;
  return safePulse;
}

function sanitizedClassContext(session: {
  title: unknown;
  subject: unknown;
  topic: unknown;
}) {
  const title = sanitizeUntrustedText(session.title, 120);
  const subject = sanitizeUntrustedText(session.subject, 120);
  const topic = sanitizeUntrustedText(session.topic, 240);
  if (!title || !subject || !topic) {
    throw new PublicFunctionError(
      422,
      "insufficient_session_context",
      "La clase no tiene suficiente contexto para generar una orientación.",
    );
  }
  return { title, subject, topic };
}

export function buildPublicationSource(input: {
  session: { title: unknown; subject: unknown; topic: unknown };
  pulses: PulseAggregate[];
  maps: Array<{ pulse_ordinal: number; map: ProjectedConfusionMap }>;
}): PublicationSource {
  const source: PublicationSource = {
    kind: "publication_draft",
    class_context: sanitizedClassContext(input.session),
    pulses: [...input.pulses]
      .sort((first, second) => first.ordinal - second.ordinal)
      .map(publicPulse),
    comparisons: buildPulseDeltas(input.pulses),
    confusion_maps: [...input.maps]
      .sort((first, second) => first.pulse_ordinal - second.pulse_ordinal),
  };
  assertProviderSourceSafe(source);
  return source;
}

export function buildMicroInterventionSource(input: {
  session: { title: unknown; subject: unknown; topic: unknown };
  pulse: PulseAggregate;
  map: ProjectedConfusionMap;
  conceptIndex: number;
}): MicroInterventionSource {
  const concept = input.map.concepts[input.conceptIndex];
  if (!concept) {
    throw new PublicFunctionError(
      422,
      "concept_not_found",
      "El concepto seleccionado ya no está disponible en este mapa.",
    );
  }

  const source: MicroInterventionSource = {
    kind: "micro_intervention",
    class_context: sanitizedClassContext(input.session),
    pulse: publicPulse(input.pulse),
    confusion_context: {
      overview: input.map.overview,
      confusion_level: input.map.confusion_level,
      concept,
      recommendations: input.map.recommendations,
    },
  };
  assertProviderSourceSafe(source);
  return source;
}

function visitProviderValue(value: unknown, path: string): string | null {
  if (typeof value === "string") {
    const forbidden = findForbiddenContent(value);
    return forbidden ? `${path}:${forbidden}` : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const violation = visitProviderValue(value[index], `${path}[${index}]`);
      if (violation) return violation;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_PROVIDER_KEYS.has(key.toLowerCase())) {
        return `${path}.${key}:forbidden_key`;
      }
      const violation = visitProviderValue(nested, `${path}.${key}`);
      if (violation) return violation;
    }
  }
  return null;
}

export function assertProviderSourceSafe(source: ArtifactSource) {
  if (visitProviderValue(source, "source")) {
    throw new PublicFunctionError(
      500,
      "unsafe_source_payload",
      "No pudimos preparar una fuente privada para la generación.",
    );
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export async function createSourceFingerprint(source: ArtifactSource) {
  assertProviderSourceSafe(source);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(source)),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function artifactJsonSchema(kind: ArtifactKind) {
  if (kind === "publication_draft") {
    return {
      type: "object",
      properties: {
        summary: { type: "string", minLength: 10, maxLength: 5_000 },
        resources_and_next_steps: {
          type: "string",
          minLength: 0,
          maxLength: 2_000,
        },
        review_notes: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              field: { type: "string", enum: ["summary", "resources"] },
              message: { type: "string", minLength: 1, maxLength: 400 },
            },
            required: ["field", "message"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "resources_and_next_steps", "review_notes"],
      additionalProperties: false,
    };
  }

  const boundedTextSchema = (maxLength: number) => ({
    type: "string",
    minLength: 1,
    maxLength,
  });
  return {
    type: "object",
    properties: {
      title: boundedTextSchema(160),
      objective: boundedTextSchema(500),
      duration_minutes: { type: "integer", minimum: 3, maximum: 5 },
      explanation: boundedTextSchema(1_200),
      example: boundedTextSchema(800),
      steps: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            instruction: boundedTextSchema(500),
            duration_minutes: { type: "integer", minimum: 1, maximum: 4 },
          },
          required: ["instruction", "duration_minutes"],
          additionalProperties: false,
        },
      },
      check_question: boundedTextSchema(600),
      expected_answer: boundedTextSchema(600),
      misconception_to_watch: boundedTextSchema(600),
      follow_up_action: boundedTextSchema(700),
    },
    required: [
      "title",
      "objective",
      "duration_minutes",
      "explanation",
      "example",
      "steps",
      "check_question",
      "expected_answer",
      "misconception_to_watch",
      "follow_up_action",
    ],
    additionalProperties: false,
  };
}

function invalidModelOutput(): never {
  throw new PublicFunctionError(
    502,
    "invalid_model_output",
    "La generación no produjo una estructura válida. Intenta nuevamente.",
  );
}

function safeOutputText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.length > maxLength) {
    invalidModelOutput();
  }
  const text = value.trim();
  if (!text) invalidModelOutput();
  if (findForbiddenContent(text)) {
    throw new PublicFunctionError(
      502,
      "unsafe_model_output",
      "La generación incluyó información no permitida y fue descartada.",
    );
  }
  return text;
}

function safeOptionalOutputText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.length > maxLength) {
    invalidModelOutput();
  }
  const text = value.trim();
  if (text && findForbiddenContent(text)) {
    throw new PublicFunctionError(
      502,
      "unsafe_model_output",
      "La generación incluyó información no permitida y fue descartada.",
    );
  }
  return text;
}

function parsePublicationDraft(value: unknown): PublicationDraftResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "summary",
      "resources_and_next_steps",
      "review_notes",
    ]) ||
    !Array.isArray(value.review_notes) || value.review_notes.length > 6
  ) invalidModelOutput();

  const reviewNotes = value.review_notes.map((note) => {
    if (
      !isRecord(note) || !hasExactKeys(note, ["field", "message"]) ||
      (note.field !== "summary" && note.field !== "resources")
    ) invalidModelOutput();
    return {
      field: note.field as "summary" | "resources",
      message: safeOutputText(note.message, 400),
    };
  });

  return {
    summary: (() => {
      const summary = safeOutputText(value.summary, 5_000);
      if (summary.length < 10) invalidModelOutput();
      return summary;
    })(),
    resources_and_next_steps: safeOptionalOutputText(
      value.resources_and_next_steps,
      2_000,
    ),
    review_notes: reviewNotes,
  };
}

function parseMicroIntervention(value: unknown): MicroInterventionResult {
  const expectedKeys = [
    "title",
    "objective",
    "duration_minutes",
    "explanation",
    "example",
    "steps",
    "check_question",
    "expected_answer",
    "misconception_to_watch",
    "follow_up_action",
  ];
  if (
    !isRecord(value) || !hasExactKeys(value, expectedKeys) ||
    !Number.isSafeInteger(value.duration_minutes) ||
    (value.duration_minutes as number) < 3 ||
    (value.duration_minutes as number) > 5 ||
    !Array.isArray(value.steps) || value.steps.length < 2 ||
    value.steps.length > 5
  ) invalidModelOutput();

  const steps = value.steps.map((step) => {
    if (
      !isRecord(step) ||
      !hasExactKeys(step, ["instruction", "duration_minutes"]) ||
      !Number.isSafeInteger(step.duration_minutes) ||
      (step.duration_minutes as number) < 1 ||
      (step.duration_minutes as number) > 4
    ) invalidModelOutput();
    return {
      instruction: safeOutputText(step.instruction, 500),
      duration_minutes: step.duration_minutes as number,
    };
  });

  const totalStepMinutes = steps.reduce(
    (total, step) => total + step.duration_minutes,
    0,
  );
  if (totalStepMinutes !== value.duration_minutes) invalidModelOutput();

  return {
    title: safeOutputText(value.title, 160),
    objective: safeOutputText(value.objective, 500),
    duration_minutes: value.duration_minutes as number,
    explanation: safeOutputText(value.explanation, 1_200),
    example: safeOutputText(value.example, 800),
    steps,
    check_question: safeOutputText(value.check_question, 600),
    expected_answer: safeOutputText(value.expected_answer, 600),
    misconception_to_watch: safeOutputText(
      value.misconception_to_watch,
      600,
    ),
    follow_up_action: safeOutputText(value.follow_up_action, 700),
  };
}

export function parseArtifactOutput(
  kind: ArtifactKind,
  value: unknown,
): ArtifactResult {
  return kind === "publication_draft"
    ? parsePublicationDraft(value)
    : parseMicroIntervention(value);
}
