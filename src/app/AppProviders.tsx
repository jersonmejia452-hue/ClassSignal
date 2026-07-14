import type { ReactNode } from 'react'

import { ConfigurationPage } from '../pages/ConfigurationPage'
import { AuthProvider } from '../context/AuthContext'
import { isSupabaseConfigured } from '../services/supabase'

export function AppProviders({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <ConfigurationPage />

  return <AuthProvider>{children}</AuthProvider>
}
