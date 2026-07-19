import type { AuthFormValues } from '../schemas/auth'
import type { StudentAuthValues } from '../schemas/studentAuth'
import { getAccountSupabase } from './supabase'

const studentPortalRoot = '/estudiante'

export function getSafeStudentRedirectPath(path?: string | null) {
  if (!path?.startsWith('/') || path.startsWith('//')) return studentPortalRoot

  try {
    const parsed = new URL(path, 'https://classsignal.local')
    const isStudentPath = parsed.pathname === studentPortalRoot
      || parsed.pathname.startsWith(`${studentPortalRoot}/`)

    return isStudentPath
      ? `${parsed.pathname}${parsed.search}`
      : studentPortalRoot
  } catch {
    return studentPortalRoot
  }
}

export async function signInProfessor(values: AuthFormValues) {
  const { data, error } = await getAccountSupabase().auth.signInWithPassword({
    email: values.email,
    password: values.password,
  })

  if (error) throw error
  return data
}

export async function signInStudentWithMagicLink(
  values: StudentAuthValues,
  redirectPath?: string | null,
) {
  const safeRedirectPath = getSafeStudentRedirectPath(redirectPath)
  const { data, error } = await getAccountSupabase().auth.signInWithOtp({
    email: values.email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${window.location.origin}${safeRedirectPath}`,
      shouldCreateUser: true,
    },
  })

  if (error) throw error
  return data
}

export async function signOutAccount() {
  const { error } = await getAccountSupabase().auth.signOut({ scope: 'local' })
  if (error) throw error
}
