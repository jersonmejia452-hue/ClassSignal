import { createClient } from "@supabase/supabase-js";

import {
  parseExpectedHostnames,
  TURNSTILE_ACTION,
  verifyTurnstileToken,
} from "./turnstile.ts";

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  const clientIp = getClientIp(request);
  if (clientIp) return clientIp;

  return `unknown:${
    (request.headers.get("user-agent") ?? "none").slice(0, 180)
  }`;
}

function isLikelyIpAddress(value: string) {
  return value.length <= 64 && /^[0-9a-f:.]+$/i.test(value) &&
    (value.includes(".") || value.includes(":"));
}

function getClientIp(request: Request) {
  const directAddress = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");
  const normalizedDirectAddress = directAddress?.trim();
  if (
    normalizedDirectAddress && isLikelyIpAddress(normalizedDirectAddress)
  ) {
    return normalizedDirectAddress;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return undefined;

  return forwarded
    .split(",")
    .map((address) => address.trim())
    .reverse()
    .find(isLikelyIpAddress);
}

function getServerConfiguration() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const hmacSecret = Deno.env.get("RESPONSE_HMAC_SECRET")?.trim();
  const turnstileSiteKey = Deno.env.get("TURNSTILE_SITE_KEY")?.trim();
  const turnstileSecretKey = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim();
  const expectedHostnames = parseExpectedHostnames(
    Deno.env.get("TURNSTILE_EXPECTED_HOSTNAMES"),
  );

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !hmacSecret || hmacSecret.length < 43 ||
    !turnstileSiteKey || turnstileSiteKey.length < 20 ||
    !turnstileSecretKey || turnstileSecretKey.length < 20 ||
    expectedHostnames.length === 0
  ) {
    throw new PublicFunctionError(
      503,
      "submission_not_configured",
      "El envío seguro de respuestas no está configurado temporalmente.",
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    hmacSecret,
    turnstile: {
      siteKey: turnstileSiteKey,
      secretKey: turnstileSecretKey,
      expectedHostnames,
    },
  };
}

async function createHmac(source: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(source),
    ),
  );
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

async function createPulseAnonymousId(
  pulseId: string,
  clientAnonymousId: string,
  secret: string,
) {
  const digest = await createHmac(
    `anonymous:${pulseId}:${clientAnonymousId}`,
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
  const pulseId = value.pulseId;
  const anonymousId = value.anonymousId;
  const status = value.status;
  const questionText = value.questionText;
  const turnstileToken = value.turnstileToken;

  if (
    typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId) ||
    typeof pulseId !== "string" || !UUID_PATTERN.test(pulseId) ||
    typeof anonymousId !== "string" || !UUID_PATTERN.test(anonymousId) ||
    typeof status !== "string" || !RESPONSE_STATUSES.has(status) ||
    typeof turnstileToken !== "string" || turnstileToken.length === 0 ||
    turnstileToken.length > 2048 ||
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
    pulseId,
    anonymousId,
    status,
    questionText: normalizedQuestion || null,
    turnstileToken,
  };
}

function mapDatabaseError(error: unknown) {
  const databaseError = getDatabaseError(error);

  if (databaseError.code === "23505") {
    return new PublicFunctionError(
      409,
      "duplicate_response",
      "Ya enviaste una respuesta desde este dispositivo para este pulso.",
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
      message:
        "Se recibieron demasiados envíos desde esta red. Espera unos minutos.",
    },
    session_response_limit: {
      status: 409,
      code: "session_response_limit",
      message: "La clase alcanzó su capacidad de respuestas.",
    },
    pulse_response_limit: {
      status: 409,
      code: "pulse_response_limit",
      message: "Este pulso alcanzó su capacidad de respuestas.",
    },
    pulse_inactive: {
      status: 409,
      code: "pulse_inactive",
      message: "Este pulso ya terminó. Espera el pulso activo de la clase.",
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

  if (request.method === "GET") {
    try {
      const configuration = getServerConfiguration();
      return jsonResponse({
        turnstile: {
          siteKey: configuration.turnstile.siteKey,
          action: TURNSTILE_ACTION,
        },
      });
    } catch (error) {
      return errorResponse(
        error instanceof PublicFunctionError ? error : new PublicFunctionError(
          503,
          "submission_not_configured",
          "El envío seguro de respuestas no está configurado temporalmente.",
        ),
      );
    }
  }

  if (request.method !== "POST") {
    return errorResponse(
      new PublicFunctionError(
        405,
        "method_not_allowed",
        "Usa una solicitud GET o POST válida.",
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
    const configuration = getServerConfiguration();
    const verification = await verifyTurnstileToken({
      token: submission.turnstileToken,
      secretKey: configuration.turnstile.secretKey,
      expectedCData: submission.pulseId,
      remoteIp: getClientIp(request),
      expectedHostnames: configuration.turnstile.expectedHostnames,
    });

    if (!verification.valid) {
      console.warn("Turnstile verification rejected", {
        reason: verification.reason,
        errorCodes: verification.errorCodes,
      });
      throw new PublicFunctionError(
        verification.reason === "unavailable" ? 503 : 403,
        verification.reason === "unavailable"
          ? "verification_unavailable"
          : "verification_failed",
        verification.reason === "unavailable"
          ? "La verificación de seguridad no está disponible. Intenta nuevamente."
          : "No pudimos verificar el envío. Intenta nuevamente.",
      );
    }

    const networkFingerprint = await createDailyNetworkFingerprint(
      request,
      configuration.hmacSecret,
    );
    const serverAnonymousId = await createPulseAnonymousId(
      submission.pulseId,
      submission.anonymousId,
      configuration.hmacSecret,
    );
    const supabase = createClient(
      configuration.supabaseUrl,
      configuration.serviceRoleKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data, error } = await supabase.rpc(
      "submit_student_response_server_v2",
      {
        p_session_id: submission.sessionId,
        p_pulse_id: submission.pulseId,
        p_anonymous_id: serverAnonymousId,
        p_status: submission.status,
        p_question_text: submission.questionText,
        p_network_fingerprint: networkFingerprint,
      },
    );

    if (error) throw mapDatabaseError(error);
    const outcome = isRecord(data) && typeof data.outcome === "string"
      ? data.outcome
      : null;

    if (outcome !== "accepted") {
      const outcomeErrors: Record<string, PublicFunctionError> = {
        duplicate_response: new PublicFunctionError(
          409,
          "duplicate_response",
          "Ya enviaste una respuesta desde este dispositivo para este pulso.",
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
        pulse_response_limit: new PublicFunctionError(
          409,
          "pulse_response_limit",
          "Este pulso alcanzó su capacidad de respuestas.",
        ),
        pulse_inactive: new PublicFunctionError(
          409,
          "pulse_inactive",
          "Este pulso ya terminó. Espera el pulso activo de la clase.",
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
