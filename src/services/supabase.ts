import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '../lib/env'
import {
  classSignalStorageKeys,
  migrateTeacherAuthStorage,
} from '../lib/storageMigration'

let accountClient: SupabaseClient | null = null
let publicClient: SupabaseClient | null = null

function resolveTeacherAuthStorageKey() {
  if (typeof window === 'undefined') return classSignalStorageKeys.teacherAuth

  try {
    return migrateTeacherAuthStorage(window.localStorage)
  } catch {
    return classSignalStorageKeys.teacherAuth
  }
}

if (env) {
  const teacherAuthStorageKey = resolveTeacherAuthStorageKey()

  accountClient = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey: teacherAuthStorageKey,
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
        storageKey: classSignalStorageKeys.publicAuth,
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
  return getAccountSupabase()
}

export function getAccountSupabase() {
  if (!accountClient) throw missingConfigurationError()
  return accountClient
}

export function getPublicSupabase() {
  if (!publicClient) throw missingConfigurationError()
  return publicClient
}

export const isSupabaseConfigured = Boolean(accountClient && publicClient)
