import { describe, expect, it } from 'vitest'

import { LUNA_PRICING_VERSION, readLunaUsage } from './openai-usage'

describe('readLunaUsage', () => {
  it('calcula el costo con entrada normal, caché y salida de Luna', () => {
    expect(readLunaUsage({
      input_tokens: 1000,
      input_tokens_details: { cached_tokens: 200 },
      output_tokens: 500,
      output_tokens_details: { reasoning_tokens: 300 },
      total_tokens: 1500,
    })).toEqual({
      inputTokens: 1000,
      cachedInputTokens: 200,
      outputTokens: 500,
      reasoningTokens: 300,
      totalTokens: 1500,
      estimatedCost: 0.00382,
    })
    expect(LUNA_PRICING_VERSION).toBe('gpt-5.6-luna:2026-07-15:standard')
  })

  it('limita detalles inconsistentes al total correspondiente', () => {
    const usage = readLunaUsage({
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 500 },
      output_tokens: 20,
      output_tokens_details: { reasoning_tokens: 40 },
      total_tokens: 120,
    })

    expect(usage?.cachedInputTokens).toBe(100)
    expect(usage?.reasoningTokens).toBe(20)
  })

  it('aplica el recargo de contexto largo después de 272K tokens de entrada', () => {
    const usage = readLunaUsage({
      input_tokens: 300_000,
      input_tokens_details: { cached_tokens: 100_000 },
      output_tokens: 10_000,
      total_tokens: 310_000,
    })

    expect(usage?.estimatedCost).toBe(0.51)
  })

  it('rechaza objetos sin contadores completos', () => {
    expect(readLunaUsage({ input_tokens: 100 })).toBeNull()
    expect(readLunaUsage(null)).toBeNull()
  })
})
