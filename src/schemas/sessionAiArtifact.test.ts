import { describe, expect, it } from 'vitest'

import {
  microInterventionResultSchema,
  sessionAiArtifactErrorSchema,
  sessionAiArtifactInvocationSchema,
  sessionAiArtifactSchema,
} from './sessionAiArtifact'

const baseArtifact = {
  id: '00000000-0000-4000-8000-000000000001',
  professor_id: '00000000-0000-4000-8000-000000000002',
  session_id: '00000000-0000-4000-8000-000000000003',
  status: 'pending',
  model: 'gpt-5.6-luna',
  reasoning_effort: 'medium',
  prompt_version: 1,
  source_fingerprint: 'a'.repeat(64),
  source_captured_at: '2026-07-21T14:59:55.000Z',
  error_code: null,
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
  created_at: '2026-07-21T15:00:00.000Z',
  completed_at: null,
}

const microResult = {
  title: 'Contrasta dos ejemplos',
  objective: 'Distinguir los dos conceptos.',
  duration_minutes: 3,
  explanation: 'Presenta ambos casos sin atribuir errores a personas.',
  example: 'Compara un caso directo con uno alternativo.',
  steps: [
    { instruction: 'Presenta el primer caso.', duration_minutes: 1 },
    { instruction: 'Contrasta el segundo caso.', duration_minutes: 1 },
    { instruction: 'Pide una explicación breve.', duration_minutes: 1 },
  ],
  check_question: '¿Qué cambia entre ambos casos?',
  expected_answer: 'Cambia la relación relevante entre las cantidades.',
  misconception_to_watch: 'Aplicar la misma regla sin revisar el contexto.',
  follow_up_action: 'Retoma un ejemplo más simple si persiste la confusión.',
}

const completedMicroArtifact = {
  ...baseArtifact,
  status: 'completed',
  kind: 'micro_intervention',
  pulse_id: '00000000-0000-4000-8000-000000000004',
  source_analysis_id: '00000000-0000-4000-8000-000000000005',
  concept_index: 0,
  result: microResult,
  input_tokens: 100,
  cached_input_tokens: 20,
  output_tokens: 50,
  reasoning_tokens: 10,
  total_tokens: 150,
  completed_at: '2026-07-21T15:00:05.000Z',
}

describe('sessionAiArtifact schemas', () => {
  it('acepta una microintervención completada y estrictamente tipada', () => {
    expect(sessionAiArtifactSchema.safeParse(completedMicroArtifact).success).toBe(true)
  })

  it('acepta un borrador pendiente sin datos terminales', () => {
    expect(sessionAiArtifactSchema.safeParse({
      ...baseArtifact,
      kind: 'publication_draft',
      pulse_id: null,
      source_analysis_id: null,
      concept_index: null,
      result: null,
    }).success).toBe(true)
  })

  it('rechaza campos adicionales en filas y resultados', () => {
    expect(sessionAiArtifactSchema.safeParse({
      ...completedMicroArtifact,
      unexpected: true,
    }).success).toBe(false)
    expect(microInterventionResultSchema.safeParse({
      ...microResult,
      student_id: 'forbidden',
    }).success).toBe(false)
  })

  it('rechaza una duración total distinta de la suma de pasos', () => {
    expect(microInterventionResultSchema.safeParse({
      ...microResult,
      duration_minutes: 5,
    }).success).toBe(false)
  })

  it('rechaza telemetría en un artefacto pendiente', () => {
    expect(sessionAiArtifactSchema.safeParse({
      ...baseArtifact,
      kind: 'publication_draft',
      pulse_id: null,
      source_analysis_id: null,
      concept_index: null,
      result: null,
      input_tokens: 1,
    }).success).toBe(false)
  })

  it('valida una invocación en progreso y errores públicos sin extras', () => {
    expect(sessionAiArtifactInvocationSchema.safeParse({
      artifact: {
        ...baseArtifact,
        kind: 'publication_draft',
        pulse_id: null,
        source_analysis_id: null,
        concept_index: null,
        result: null,
      },
      cached: false,
      in_progress: true,
    }).success).toBe(true)
    expect(sessionAiArtifactErrorSchema.safeParse({
      error: { code: 'artifact_failed', message: 'No se pudo generar.', internal: true },
    }).success).toBe(false)
  })

  it('rechaza combinaciones contradictorias de caché y progreso', () => {
    expect(sessionAiArtifactInvocationSchema.safeParse({
      artifact: completedMicroArtifact,
      cached: false,
      in_progress: true,
    }).success).toBe(false)
    expect(sessionAiArtifactInvocationSchema.safeParse({
      artifact: {
        ...baseArtifact,
        kind: 'publication_draft',
        pulse_id: null,
        source_analysis_id: null,
        concept_index: null,
        result: null,
      },
      cached: true,
      in_progress: true,
    }).success).toBe(false)
  })
})
