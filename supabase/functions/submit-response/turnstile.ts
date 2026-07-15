export const TURNSTILE_ACTION = "submit_response";
export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TURNSTILE_TOKEN_MAX_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 8_000;

interface TurnstileSiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
}

export type TurnstileVerificationResult =
  | { valid: true }
  | {
    valid: false;
    reason: "rejected" | "unavailable";
    errorCodes: string[];
  };

interface VerifyTurnstileTokenOptions {
  token: string;
  secretKey: string;
  expectedCData: string;
  remoteIp?: string;
  expectedHostnames?: string[];
  fetcher?: typeof fetch;
  timeoutMs?: number;
  idempotencyKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSiteverifyResponse(value: unknown): TurnstileSiteverifyResponse | null {
  if (!isRecord(value) || typeof value.success !== "boolean") return null;

  const errorCodes = value["error-codes"];
  if (
    errorCodes !== undefined &&
    (!Array.isArray(errorCodes) ||
      errorCodes.some((code) => typeof code !== "string"))
  ) {
    return null;
  }

  return {
    success: value.success,
    hostname: typeof value.hostname === "string" ? value.hostname : undefined,
    action: typeof value.action === "string" ? value.action : undefined,
    cdata: typeof value.cdata === "string" ? value.cdata : undefined,
    "error-codes": errorCodes as string[] | undefined,
  };
}

export function parseExpectedHostnames(value: string | undefined) {
  if (!value) return [];

  return Array.from(new Set(
    value
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean),
  ));
}

export async function verifyTurnstileToken({
  token,
  secretKey,
  expectedCData,
  remoteIp,
  expectedHostnames = [],
  fetcher = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  idempotencyKey = crypto.randomUUID(),
}: VerifyTurnstileTokenOptions): Promise<TurnstileVerificationResult> {
  if (!token || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    return {
      valid: false,
      reason: "rejected",
      errorCodes: ["invalid-input-response"],
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    formData.append("idempotency_key", idempotencyKey);
    if (remoteIp) formData.append("remoteip", remoteIp);

    const response = await fetcher(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        valid: false,
        reason: "unavailable",
        errorCodes: ["siteverify-http-error"],
      };
    }

    const result = parseSiteverifyResponse(await response.json());
    if (!result) {
      return {
        valid: false,
        reason: "unavailable",
        errorCodes: ["invalid-siteverify-response"],
      };
    }

    const errorCodes = result["error-codes"] ?? [];
    if (!result.success) {
      return {
        valid: false,
        reason: errorCodes.includes("internal-error")
          ? "unavailable"
          : "rejected",
        errorCodes,
      };
    }

    if (result.action !== TURNSTILE_ACTION) {
      return {
        valid: false,
        reason: "rejected",
        errorCodes: ["action-mismatch"],
      };
    }

    if (result.cdata !== expectedCData) {
      return {
        valid: false,
        reason: "rejected",
        errorCodes: ["cdata-mismatch"],
      };
    }

    const normalizedHostname = result.hostname
      ?.trim()
      .toLowerCase()
      .replace(/\.$/, "");
    if (
      expectedHostnames.length > 0 &&
      (!normalizedHostname || !expectedHostnames.includes(normalizedHostname))
    ) {
      return {
        valid: false,
        reason: "rejected",
        errorCodes: ["hostname-mismatch"],
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      reason: "unavailable",
      errorCodes: ["siteverify-unavailable"],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
