import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '../lib/env'

let teacherClient: SupabaseClient | null = null
let publicClient: SupabaseClient | null = null

if (env) {
  teacherClient = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey: 'aula-clara:teacher-auth:v1',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )

  publicClient = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey: 'aula-clara:public-auth:v1',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )
}

function missingConfigurationError() {
  return new Error(
    'Supabase no está configurado. Revisa las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

export function getTeacherSupabase() {
  if (!teacherClient) throw missingConfigurationError()
  return teacherClient
}

export function getPublicSupabase() {
  if (!publicClient) throw missingConfigurationError()
  return publicClient
}

export const isSupabaseConfigured = Boolean(teacherClient && publicClient)
