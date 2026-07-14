import { z } from 'zod'

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
)

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  VITE_PUBLIC_APP_URL: optionalUrl,
})

const result = envSchema.safeParse(import.meta.env)

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
