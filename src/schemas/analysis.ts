import { z } from 'zod'

import {
  analysisSeverities,
  analysisStatuses,
  confusionLevels,
  recommendationPriorities,
} from '../types/domain'

export const confusionConceptSchema = z.object({
  concept: z.string().trim().min(1).max(160),
  explanation: z.string().trim().min(1).max(700),
  severity: z.enum(analysisSeverities),
  affected_students: z.number().int().positive(),
  evidence: z.array(z.string().trim().min(1).max(260)).max(3),
})

export const teachingRecommendationSchema = z.object({
  title: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(700),
  priority: z.enum(recommendationPriorities),
})

export const confusionMapSchema = z.object({
  overview: z.string().trim().min(1).max(1200),
  confusion_level: z.enum(confusionLevels),
  concepts: z.array(confusionConceptSchema).max(10),
  recommendations: z.array(teachingRecommendationSchema).max(8),
})

export const sessionAnalysisSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  professor_id: z.string().uuid(),
  status: z.enum(analysisStatuses),
  model: z.string().trim().min(1).max(100),
  prompt_version: z.number().int().positive(),
  response_count: z.number().int().positive(),
  source_latest_response_at: z.string().min(1),
  result: confusionMapSchema.nullable(),
  error_message: z.string().trim().min(1).max(500).nullable(),
  created_at: z.string().min(1),
  completed_at: z.string().min(1).nullable(),
})

export const analysisInvocationSchema = z.object({
  analysis: sessionAnalysisSchema,
  cached: z.boolean(),
})

export const analysisErrorSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().min(1),
  }),
})
