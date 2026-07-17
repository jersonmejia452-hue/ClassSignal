import { z } from 'zod'

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
)

const booleanString = z.preprocess(
  (value) => (value === undefined || value === '' ? 'false' : value),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
)

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20)
    .refine((value) => value.trim().startsWith('sb_publishable_'), {
      message: 'Use a Supabase publishable key',
    }),
  VITE_PUBLIC_APP_URL: optionalUrl,
  VITE_PROFESSOR_SIGNUP_ENABLED: booleanString,
})

export function parsePublicEnvironment(
  buildEnvironment: Record<string, unknown>,
  runtimeEnvironment?: {
    VITE_SUPABASE_URL?: unknown
    VITE_SUPABASE_PUBLISHABLE_KEY?: unknown
  },
) {
  const supabaseEnvironment = runtimeEnvironment ?? buildEnvironment

  return envSchema.safeParse({
    VITE_SUPABASE_URL: supabaseEnvironment.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      supabaseEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_PUBLIC_APP_URL: buildEnvironment.VITE_PUBLIC_APP_URL,
    VITE_PROFESSOR_SIGNUP_ENABLED:
      buildEnvironment.VITE_PROFESSOR_SIGNUP_ENABLED,
  })
}

const runtimeEnvironment =
  typeof window === 'undefined' ? undefined : window.__CLASS_SIGNAL_CONFIG__

const result = parsePublicEnvironment(import.meta.env, runtimeEnvironment)

export const env = result.success ? result.data : null

export const envIssues = result.success
  ? []
  : result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))

export function getPublicAppOrigin() {
  if (env?.VITE_PUBLIC_APP_URL) {
    return env.VITE_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  return window.location.origin
}
