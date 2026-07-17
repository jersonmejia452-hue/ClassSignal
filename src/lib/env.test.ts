import { describe, expect, it } from 'vitest'

import { parsePublicEnvironment } from './env'

const validRuntimeEnvironment = {
  VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public_key_for_tests',
}

describe('public environment configuration', () => {
  it('accepts required Supabase values supplied at runtime', () => {
    const result = parsePublicEnvironment({}, validRuntimeEnvironment)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.VITE_SUPABASE_URL).toBe(
      validRuntimeEnvironment.VITE_SUPABASE_URL,
    )
    expect(result.data.VITE_SUPABASE_PUBLISHABLE_KEY).toBe(
      validRuntimeEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY,
    )
    expect(result.data.VITE_PROFESSOR_SIGNUP_ENABLED).toBe(false)
  })

  it('lets hosted runtime values override build-time placeholders', () => {
    const result = parsePublicEnvironment(
      {
        VITE_SUPABASE_URL: 'not-a-url',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'short',
      },
      validRuntimeEnvironment,
    )

    expect(result.success).toBe(true)
  })

  it('uses build-time values only when runtime configuration is absent', () => {
    const result = parsePublicEnvironment(validRuntimeEnvironment)

    expect(result.success).toBe(true)
  })

  it('does not complete partial runtime configuration with build values', () => {
    const result = parsePublicEnvironment(validRuntimeEnvironment, {
      VITE_SUPABASE_URL: validRuntimeEnvironment.VITE_SUPABASE_URL,
    })

    expect(result.success).toBe(false)
  })

  it('rejects a secret key in the publishable key slot', () => {
    const result = parsePublicEnvironment({}, {
      VITE_SUPABASE_URL: validRuntimeEnvironment.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_expose_this_value',
    })

    expect(result.success).toBe(false)
  })
})
