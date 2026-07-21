export const LUNA_PRICING_VERSION = "gpt-5.6-luna:2026-07-15:standard";

const INPUT_PRICE_PER_MILLION = 1;
const CACHED_INPUT_PRICE_PER_MILLION = 0.1;
const OUTPUT_PRICE_PER_MILLION = 6;
const LONG_CONTEXT_INPUT_THRESHOLD = 272_000;

export interface LunaUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** Prices are intentionally valid only for the one currently allowed model. */
export function readLunaUsage(value: unknown): LunaUsage | null {
  if (!isRecord(value)) return null;

  const inputTokens = nonNegativeInteger(value.input_tokens);
  const outputTokens = nonNegativeInteger(value.output_tokens);
  const totalTokens = nonNegativeInteger(value.total_tokens);
  if (inputTokens === null || outputTokens === null || totalTokens === null) {
    return null;
  }
  if (totalTokens !== inputTokens + outputTokens) return null;

  const inputDetails = isRecord(value.input_tokens_details)
    ? value.input_tokens_details
    : null;
  const outputDetails = isRecord(value.output_tokens_details)
    ? value.output_tokens_details
    : null;
  const cachedInputTokens = Math.min(
    nonNegativeInteger(inputDetails?.cached_tokens) ?? 0,
    inputTokens,
  );
  const reasoningTokens = Math.min(
    nonNegativeInteger(outputDetails?.reasoning_tokens) ?? 0,
    outputTokens,
  );
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const usesLongContextPricing = inputTokens > LONG_CONTEXT_INPUT_THRESHOLD;
  const inputMultiplier = usesLongContextPricing ? 2 : 1;
  const outputMultiplier = usesLongContextPricing ? 1.5 : 1;
  const estimatedCost = (
    (
        uncachedInputTokens * INPUT_PRICE_PER_MILLION +
        cachedInputTokens * CACHED_INPUT_PRICE_PER_MILLION
      ) * inputMultiplier +
    outputTokens * OUTPUT_PRICE_PER_MILLION * outputMultiplier
  ) / 1_000_000;

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    estimatedCost: Number(estimatedCost.toFixed(6)),
  };
}
