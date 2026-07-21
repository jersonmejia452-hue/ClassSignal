export const MAX_STUDENT_QUESTION_CHARS = 600;
export const MAX_STUDENT_EVIDENCE_CHARS = 260;

// The database already rejects questions over 1,000 characters. Keeping the
// same server-side ceiling here bounds redaction work and lets us inspect the
// complete stored value before truncating what reaches the provider.
const MAX_STORED_QUESTION_CHARS = 1_000;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const URL_PATTERN =
  /\b(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|co|ai|app|dev)(?:\/[^\s<>()]*)?)/gi;
const SECRET_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/gi;

// Require recognizable phone grouping (or an explicit international `+`) so
// ordinary integers, years, coordinates and short course codes remain intact.
const PHONE_PATTERN =
  /(?<![\p{L}\p{N}])(?:\+\d{10,15}|(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)|\d{2,3})[\s.-]\d{3}[\s.-]\d{4})(?!\d)/gu;
const LABELED_PHONE_PATTERN =
  /\b((?:tel[eé]fono|celular|m[oó]vil|whatsapp|contacto)\s*(?:es|:|=)?\s*)\+?\d(?:[\s.-]?\d){6,14}\b/giu;

function boundedLimit(maxLength: number) {
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    return MAX_STUDENT_QUESTION_CHARS;
  }
  return Math.min(maxLength, MAX_STORED_QUESTION_CHARS);
}

/**
 * Removes common direct identifiers from optional student text while keeping
 * the academic wording available for collective analysis. The content remains
 * untrusted data; this function is a privacy boundary, not an instruction
 * classifier.
 */
export function sanitizeStudentQuestion(
  value: unknown,
  maxLength = MAX_STUDENT_QUESTION_CHARS,
) {
  if (typeof value !== "string") return null;

  const source = value.trim().slice(0, MAX_STORED_QUESTION_CHARS);
  if (!source) return null;

  const sanitized = source
    .replace(EMAIL_PATTERN, "[correo omitido]")
    .replace(UUID_PATTERN, "[identificador omitido]")
    .replace(URL_PATTERN, "[enlace omitido]")
    .replace(SECRET_PATTERN, "[secreto omitido]")
    .replace(LABELED_PHONE_PATTERN, "$1[teléfono omitido]")
    .replace(PHONE_PATTERN, "[teléfono omitido]")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return null;
  return sanitized.slice(0, boundedLimit(maxLength));
}

/**
 * Defense in depth for the exact text persisted in `concepts[].evidence`.
 * This remains safe even if a future caller accidentally supplies a raw
 * question instead of the already-sanitized provider source.
 */
export function safeStudentEvidence(
  question: unknown,
  fallback: string,
) {
  return sanitizeStudentQuestion(question, MAX_STUDENT_EVIDENCE_CHARS) ??
    fallback;
}
