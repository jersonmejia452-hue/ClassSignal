import { describe, expect, it } from 'vitest'

import { sessionAnalysisSchema } from './analysis'

const baseAnalysis = {
  id: '00000000-0000-4000-8000-000000000003',
  session_id: '00000000-0000-4000-8000-000000000001',
  professor_id: '00000000-0000-4000-8000-000000000004',
  status: 'pending',
  model: 'gpt-5.6-luna',
  prompt_version: 1,
  response_count: 1,
  source_latest_response_at: '2026-07-18T23:00:00.000Z',
  result: null,
  error_message: null,
  input_tokens: null,
  cached_input_tokens: null,
  output_tokens: null,
  reasoning_tokens: null,
  total_tokens: null,
  estimated_cost_usd: null,
  pricing_version: null,
  duration_ms: null,
  provider_request_id: null,
  provider_response_id: null,
  created_at: '2026-07-18T23:00:00.000Z',
  completed_at: null,
}

describe('sessionAnalysisSchema pulse contracts', () => {
  it('acepta un análisis atribuido a un pulso', () => {
    expect(sessionAnalysisSchema.safeParse({
      ...baseAnalysis,
      pulse_id: '00000000-0000-4000-8000-000000000002',
    }).success).toBe(true)
  })

  it('rechaza un análisis sin pulse_id', () => {
    expect(sessionAnalysisSchema.safeParse(baseAnalysis).success).toBe(false)
  })

  it('rechaza identificadores de pulso mal formados', () => {
    expect(sessionAnalysisSchema.safeParse({
      ...baseAnalysis,
      pulse_id: 'invalid',
    }).success).toBe(false)
  })
})
