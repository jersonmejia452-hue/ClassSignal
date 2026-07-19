import { accountProfileSchema } from '../schemas/profile'
import { getAccountSupabase } from './supabase'

export async function getMyProfile(userId: string) {
  const { data, error } = await getAccountSupabase()
    .from('profiles')
    .select('id, role, display_name, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const parsed = accountProfileSchema.safeParse(data)
  if (!parsed.success) throw new Error('account_profile_invalid')
  return parsed.data
}
