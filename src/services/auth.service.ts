import type { AuthFormValues } from '../schemas/auth'
import { getTeacherSupabase } from './supabase'

export async function signInProfessor(values: AuthFormValues) {
  const { data, error } = await getTeacherSupabase().auth.signInWithPassword({
    email: values.email,
    password: values.password,
  })

  if (error) throw error
  return data
}

export async function signUpProfessor(values: AuthFormValues) {
  const { data, error } = await getTeacherSupabase().auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${window.location.origin}/profesor`,
    },
  })

  if (error) throw error
  return data
}

export async function signOutProfessor() {
  const { error } = await getTeacherSupabase().auth.signOut()
  if (error) throw error
}
