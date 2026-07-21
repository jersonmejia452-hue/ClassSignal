import { describe, expect, it } from "vitest";

import { LUNA_PRICING_VERSION, readLunaUsage } from "./openai-usage.ts";

describe("readLunaUsage", () => {
  it("valida la aritmética y calcula entrada, caché, salida y razonamiento", () => {
    expect(readLunaUsage({
      input_tokens: 1_000,
      input_tokens_details: { cached_tokens: 200 },
      output_tokens: 500,
      output_tokens_details: { reasoning_tokens: 300 },
      total_tokens: 1_500,
    })).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: 200,
      outputTokens: 500,
      reasoningTokens: 300,
      totalTokens: 1_500,
      estimatedCost: 0.00382,
    });
    expect(LUNA_PRICING_VERSION).toBe(
      "gpt-5.6-luna:2026-07-15:standard",
    );
  });

  it("usa cero para detalles ausentes y limita detalles al contador padre", () => {
    expect(readLunaUsage({
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
    })).toMatchObject({
      cachedInputTokens: 0,
      reasoningTokens: 0,
    });

    expect(readLunaUsage({
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 500 },
      output_tokens: 20,
      output_tokens_details: { reasoning_tokens: 40 },
      total_tokens: 120,
    })).toMatchObject({
      cachedInputTokens: 100,
      reasoningTokens: 20,
    });
  });

  it("aplica el multiplicador de contexto largo solo por encima de 272K", () => {
    expect(
      readLunaUsage({
        input_tokens: 272_000,
        output_tokens: 1_000,
        total_tokens: 273_000,
      })?.estimatedCost,
    ).toBe(0.278);

    expect(
      readLunaUsage({
        input_tokens: 300_000,
        input_tokens_details: { cached_tokens: 100_000 },
        output_tokens: 10_000,
        total_tokens: 310_000,
      })?.estimatedCost,
    ).toBe(0.51);
  });

  it.each([
    ["valor no objeto", null],
    ["contador ausente", { input_tokens: 10, output_tokens: 2 }],
    [
      "total aritméticamente inconsistente",
      { input_tokens: 10, output_tokens: 2, total_tokens: 13 },
    ],
    [
      "contador negativo",
      { input_tokens: -1, output_tokens: 2, total_tokens: 1 },
    ],
    [
      "contador no entero",
      { input_tokens: 1.5, output_tokens: 2, total_tokens: 3.5 },
    ],
  ])("rechaza telemetría con %s", (_label, usage) => {
    expect(readLunaUsage(usage)).toBeNull();
  });
});
