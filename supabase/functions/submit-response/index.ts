import { createClient } from "@supabase/supabase-js";

const MAX_BODY_BYTES = 5_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_STATUSES = new Set(["understood", "question", "lost"]);

class PublicFunctionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders(),
  });
}

function errorResponse(error: PublicFunctionError) {
  return jsonResponse(
    { error: { code: error.code, message: error.message } },
    error.status,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDatabaseError(error: unknown) {
  if (!isRecord(error)) return { code: "", message: "" };
  return {
    code: typeof error.code === "string" ? error.code : "",
    message: typeof error.message === "string" ? error.message : "",
  };
}

function getNetworkAddress(request: Request) {
  const directAddress = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");
  if (directAddress) return directAddress.trim().slice(0, 200);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const addresses = forwarded.split(",");
    return (addresses.at(-1) ?? forwarded).trim().slice(0, 200);
  }

  return `unknown:${(request.headers.get("user-agent") ?? "none").slice(0, 180)}`;
}

async function createHmac(source: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(source),
  ));
}

async function createDailyNetworkFingerprint(
  request: Request,
  secret: string,
) {
  const day = new Date().toISOString().slice(0, 10);
  const signature = await createHmac(
    `network:${day}:${getNetworkAddress(request)}`,
    secret,
  );

  return Array.from(
    signature,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function createSessionAnonymousId(
  sessionId: string,
  clientAnonymousId: string,
  secret: string,
) {
  const digest = await createHmac(
    `anonymous:${sessionId}:${clientAnonymousId}`,
    secret,
  );
  const uuidBytes = digest.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  const hex = Array.from(
    uuidBytes,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function parseSubmission(value: unknown) {
  if (!isRecord(value)) {
    throw new PublicFunctionError(
      400,
      "invalid_submission",
      "La respuesta enviada no es válida.",
    );
  }

  const sessionId = value.sessionId;
  const anonymousId = value.anonymousId;
  const status = value.status;
  const questionText = value.questionText;

  if (
    typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId) ||
    typeof anonymousId !== "string" || !UUID_PATTERN.test(anonymousId) ||
    typeof status !== "string" || !RESPONSE_STATUSES.has(status) ||
    (questionText !== undefined && questionText !== null &&
      typeof questionText !== "string")
  ) {
    throw new PublicFunctionError(
      400,
      "invalid_submission",
      "La respuesta enviada no es válida.",
    );
  }

  const normalizedQuestion = typeof questionText === "string"
    ? questionText.trim()
    : "";
  if (normalizedQuestion.length > 1000) {
    throw new PublicFunctionError(
      400,
      "question_too_long",
      "La duda no puede superar 1.000 caracteres.",
    );
  }

  return {
    sessionId,
    anonymousId,
    status,
    questionText: normalizedQuestion || null,
  };
}

function mapDatabaseError(error: unknown) {
  const databaseError = getDatabaseError(error);

  if (databaseError.code === "23505") {
    return new PublicFunctionError(
      409,
      "duplicate_response",
      "Ya enviaste una respuesta desde este dispositivo para esta clase.",
    );
  }

  const knownErrors: Record<
    string,
    { status: number; code: string; message: string }
  > = {
    session_not_found: {
      status: 404,
      code: "session_not_found",
      message: "No encontramos esta clase.",
    },
    session_inactive: {
      status: 410,
      code: "session_inactive",
      message: "La clase ya no está recibiendo respuestas.",
    },
    response_rate_limit: {
      status: 429,
      code: "response_rate_limit",
      message: "Se recibieron demasiados envíos desde esta red. Espera unos minutos.",
    },
    session_response_limit: {
      status: 409,
      code: "session_response_limit",
      message: "La clase alcanzó su capacidad de respuestas.",
    },
  };

  const known = knownErrors[databaseError.message];
  if (known) {
    return new PublicFunctionError(known.status, known.code, known.message);
  }

  return new PublicFunctionError(
    500,
    "submission_failed",
    "No pudimos guardar tu respuesta. Intenta nuevamente.",
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return errorResponse(
      new PublicFunctionError(
        405,
        "method_not_allowed",
        "Usa una solicitud POST para enviar una respuesta.",
      ),
    );
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new PublicFunctionError(
        413,
        "submission_too_large",
        "La respuesta enviada es demasiado grande.",
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      throw new PublicFunctionError(
        413,
        "submission_too_large",
        "La respuesta enviada es demasiado grande.",
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new PublicFunctionError(
        400,
        "invalid_json",
        "La respuesta enviada no contiene JSON válido.",
      );
    }

    const submission = parseSubmission(body);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
      throw new PublicFunctionError(
        503,
        "submission_not_configured",
        "El envío de respuestas no está configurado temporalmente.",
      );
    }

    const hmacSecret = Deno.env.get("RESPONSE_HMAC_SECRET")?.trim() ||
      serviceRoleKey;
    const networkFingerprint = await createDailyNetworkFingerprint(
      request,
      hmacSecret,
    );
    const serverAnonymousId = await createSessionAnonymousId(
      submission.sessionId,
      submission.anonymousId,
      hmacSecret,
    );
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("submit_student_response_server_v2", {
      p_session_id: submission.sessionId,
      p_anonymous_id: serverAnonymousId,
      p_status: submission.status,
      p_question_text: submission.questionText,
      p_network_fingerprint: networkFingerprint,
    });

    if (error) throw mapDatabaseError(error);
    const outcome = isRecord(data) && typeof data.outcome === "string"
      ? data.outcome
      : null;

    if (outcome !== "accepted") {
      const outcomeErrors: Record<string, PublicFunctionError> = {
        duplicate_response: new PublicFunctionError(
          409,
          "duplicate_response",
          "Ya enviaste una respuesta desde este dispositivo para esta clase.",
        ),
        session_not_found: new PublicFunctionError(
          404,
          "session_not_found",
          "No encontramos esta clase.",
        ),
        session_inactive: new PublicFunctionError(
          410,
          "session_inactive",
          "La clase ya no está recibiendo respuestas.",
        ),
        response_rate_limit: new PublicFunctionError(
          429,
          "response_rate_limit",
          "Se recibieron demasiados envíos desde esta red. Espera unos minutos.",
        ),
        session_response_limit: new PublicFunctionError(
          409,
          "session_response_limit",
          "La clase alcanzó su capacidad de respuestas.",
        ),
      };
      throw outcomeErrors[outcome ?? ""] ?? new PublicFunctionError(
        500,
        "submission_failed",
        "No pudimos guardar tu respuesta. Intenta nuevamente.",
      );
    }

    return jsonResponse({ accepted: true }, 201);
  } catch (error) {
    const publicError = error instanceof PublicFunctionError
      ? error
      : new PublicFunctionError(
        500,
        "submission_failed",
        "No pudimos guardar tu respuesta. Intenta nuevamente.",
      );

    if (!(error instanceof PublicFunctionError)) {
      console.error("Unexpected submit-response failure");
    }

    return errorResponse(publicError);
  }
});
