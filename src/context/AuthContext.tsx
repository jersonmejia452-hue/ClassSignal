import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { signOutAccount } from '../services/auth.service'
import { getMyProfile } from '../services/profiles.service'
import { getAccountSupabase } from '../services/supabase'
import type { AccountProfile, AccountRole } from '../types/domain'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: AccountProfile | null
  role: AccountRole | null
  profileError: string | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const supabase = getAccountSupabase()

    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null
      const identityChanged = currentUserIdRef.current !== nextUserId
      currentUserIdRef.current = nextUserId
      setSession(nextSession)
      if (identityChanged) {
        setProfile(null)
        setProfileError(null)
        setIsProfileLoading(Boolean(nextSession))
      }
      setIsAuthLoading(false)
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        applySession(null)
        return
      }
      applySession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) return
        applySession(nextSession)
      },
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const userId = session?.user.id

    if (!userId) {
      setProfile(null)
      setProfileError(null)
      setIsProfileLoading(false)
      return () => {
        isMounted = false
      }
    }

    setIsProfileLoading(true)
    setProfileError(null)

    void getMyProfile(userId)
      .then((nextProfile) => {
        if (!isMounted) return
        if (!nextProfile) {
          setProfile(null)
          setProfileError('account_profile_unavailable')
          return
        }
        setProfile(nextProfile)
      })
      .catch(() => {
        if (!isMounted) return
        setProfile(null)
        setProfileError('account_profile_unavailable')
      })
      .finally(() => {
        if (isMounted) setIsProfileLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [session?.user.id])

  const isLoading = isAuthLoading || isProfileLoading

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      profileError,
      isLoading,
      signOut: signOutAccount,
    }),
    [isLoading, profile, profileError, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.')
  }

  return context
}
