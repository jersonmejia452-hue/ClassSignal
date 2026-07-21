import { z } from 'zod'

import {
  sessionAiArtifactReasoningEfforts,
  sessionAiArtifactStatuses,
} from '../types/domain'

export const publicationDraftReviewNoteSchema = z.object({
  field: z.enum(['summary', 'resources']),
  message: z.string().trim().min(1).max(400),
}).strict()

export const publicationDraftArtifactResultSchema = z.object({
  summary: z.string().trim().min(10).max(5_000),
  resources_and_next_steps: z.string().trim().max(2_000),
  review_notes: z.array(publicationDraftReviewNoteSchema).max(6),
}).strict()

export const microInterventionStepSchema = z.object({
  instruction: z.string().trim().min(1).max(500),
  duration_minutes: z.number().int().min(1).max(4),
}).strict()

export const microInterventionResultSchema = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(500),
  duration_minutes: z.number().int().min(3).max(5),
  explanation: z.string().trim().min(1).max(1_200),
  example: z.string().trim().min(1).max(800),
  steps: z.array(microInterventionStepSchema).min(2).max(5),
  check_question: z.string().trim().min(1).max(600),
  expected_answer: z.string().trim().min(1).max(600),
  misconception_to_watch: z.string().trim().min(1).max(600),
  follow_up_action: z.string().trim().min(1).max(700),
}).strict().superRefine((result, context) => {
  const stepDuration = result.steps.reduce(
    (total, step) => total + step.duration_minutes,
    0,
  )
  if (stepDuration !== result.duration_minutes) {
    context.addIssue({
      code: 'custom',
      message: 'La duración de los pasos debe coincidir con la duración total.',
      path: ['steps'],
    })
  }
})

const nullableTokenCount = z.number().int().min(0).max(10_000_000).nullable()
const nullableBoundedText = (maximum: number) => (
  z.string().trim().min(1).max(maximum).nullable()
)

const artifactBaseShape = {
  id: z.string().uuid(),
  professor_id: z.string().uuid(),
  session_id: z.string().uuid(),
  status: z.enum(sessionAiArtifactStatuses),
  model: z.string().trim().min(1).max(100),
  reasoning_effort: z.enum(sessionAiArtifactReasoningEfforts),
  prompt_version: z.number().int().positive(),
  source_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  source_captured_at: z.string().datetime({ offset: true }),
  error_code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).nullable(),
  error_message: nullableBoundedText(500),
  input_tokens: nullableTokenCount,
  cached_input_tokens: nullableTokenCount,
  output_tokens: nullableTokenCount,
  reasoning_tokens: nullableTokenCount,
  total_tokens: z.number().int().min(0).max(20_000_000).nullable(),
  estimated_cost_usd: z.number().min(0).max(100).nullable(),
  pricing_version: nullableBoundedText(100),
  duration_ms: z.number().int().min(0).max(600_000).nullable(),
  provider_request_id: nullableBoundedText(200),
  provider_response_id: nullableBoundedText(200),
  created_at: z.string().min(1),
  completed_at: z.string().min(1).nullable(),
}

const publicationDraftArtifactSchema = z.object({
  ...artifactBaseShape,
  kind: z.literal('publication_draft'),
  pulse_id: z.null(),
  source_analysis_id: z.null(),
  concept_index: z.null(),
  result: publicationDraftArtifactResultSchema.nullable(),
}).strict()

const microInterventionArtifactSchema = z.object({
  ...artifactBaseShape,
  kind: z.literal('micro_intervention'),
  pulse_id: z.string().uuid(),
  source_analysis_id: z.string().uuid(),
  concept_index: z.number().int().nonnegative().max(9),
  result: microInterventionResultSchema.nullable(),
}).strict()

export const sessionAiArtifactSchema = z.discriminatedUnion('kind', [
  publicationDraftArtifactSchema,
  microInterventionArtifactSchema,
]).superRefine((artifact, context) => {
  const isPending = artifact.status === 'pending'
  const isCompleted = artifact.status === 'completed'
  const isFailed = artifact.status === 'failed'

  const pendingOnlyValues = [
    artifact.result,
    artifact.error_code,
    artifact.error_message,
    artifact.input_tokens,
    artifact.cached_input_tokens,
    artifact.output_tokens,
    artifact.reasoning_tokens,
    artifact.total_tokens,
    artifact.estimated_cost_usd,
    artifact.pricing_version,
    artifact.duration_ms,
    artifact.provider_request_id,
    artifact.provider_response_id,
    artifact.completed_at,
  ]
  if (isPending && pendingOnlyValues.some((value) => value !== null)) {
    context.addIssue({ code: 'custom', message: 'Un artefacto pendiente contiene datos terminales.' })
  }
  if (isCompleted && (
    artifact.result === null
    || artifact.error_code !== null
    || artifact.error_message !== null
    || artifact.completed_at === null
  )) {
    context.addIssue({ code: 'custom', message: 'Un artefacto completado es inconsistente.' })
  }
  if (isFailed && (
    artifact.result !== null
    || artifact.error_code === null
    || artifact.error_message === null
    || artifact.completed_at === null
  )) {
    context.addIssue({ code: 'custom', message: 'Un artefacto fallido es inconsistente.' })
  }
  if (
    artifact.cached_input_tokens !== null
    && artifact.input_tokens !== null
    && artifact.cached_input_tokens > artifact.input_tokens
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Los tokens en caché superan los tokens de entrada.',
      path: ['cached_input_tokens'],
    })
  }
  if (
    artifact.reasoning_tokens !== null
    && artifact.output_tokens !== null
    && artifact.reasoning_tokens > artifact.output_tokens
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Los tokens de razonamiento superan los tokens de salida.',
      path: ['reasoning_tokens'],
    })
  }
  if (
    artifact.total_tokens !== null
    && (
      artifact.input_tokens === null
      || artifact.output_tokens === null
      || artifact.total_tokens !== artifact.input_tokens + artifact.output_tokens
    )
  ) {
    context.addIssue({
      code: 'custom',
      message: 'El total de tokens no coincide con entrada más salida.',
      path: ['total_tokens'],
    })
  }
})

export const sessionAiArtifactListSchema = z.array(sessionAiArtifactSchema)

const generationRequestBase = {
  sessionId: z.string().uuid(),
  regenerate: z.boolean().optional(),
}

export const sessionAiArtifactGenerationRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    ...generationRequestBase,
    kind: z.literal('publication_draft'),
  }).strict(),
  z.object({
    ...generationRequestBase,
    kind: z.literal('micro_intervention'),
    pulseId: z.string().uuid(),
    conceptIndex: z.number().int().nonnegative().max(9),
  }).strict(),
])

export const sessionAiArtifactInvocationSchema = z.object({
  artifact: sessionAiArtifactSchema,
  cached: z.boolean(),
  in_progress: z.boolean().optional(),
}).strict().superRefine((invocation, context) => {
  const isPending = invocation.artifact.status === 'pending'
  if (invocation.cached && isPending) {
    context.addIssue({ code: 'custom', message: 'Un artefacto en caché no puede estar pendiente.' })
  }
  if (Boolean(invocation.in_progress) !== isPending) {
    context.addIssue({ code: 'custom', message: 'El estado de progreso no coincide con el artefacto.' })
  }
})

export const sessionAiArtifactErrorSchema = z.object({
  error: z.object({
    code: z.string().trim().min(1).max(100).optional(),
    message: z.string().trim().min(1).max(500),
  }).strict(),
}).strict()

export type SessionAiArtifactGenerationRequest = z.infer<
  typeof sessionAiArtifactGenerationRequestSchema
>
