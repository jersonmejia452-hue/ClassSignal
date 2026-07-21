import type { ArtifactTelemetry } from "./types.ts";

export class PublicFunctionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly telemetry: ArtifactTelemetry | null = null,
  ) {
    super(message);
    this.name = "PublicFunctionError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export function getErrorCode(error: unknown) {
  if (!isRecord(error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export function getDatabaseErrorMessage(error: unknown) {
  if (!isRecord(error)) return undefined;
  return typeof error.message === "string" ? error.message : undefined;
}

export function attachTelemetry(
  error: unknown,
  telemetry: ArtifactTelemetry,
) {
  if (!(error instanceof PublicFunctionError) || error.telemetry) return error;
  return new PublicFunctionError(
    error.status,
    error.code,
    error.message,
    telemetry,
  );
}
