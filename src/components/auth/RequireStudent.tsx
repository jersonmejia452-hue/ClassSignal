import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { AccountAccessError } from './AccountAccessError'
import { LoadingScreen } from '../ui/LoadingScreen'

export function RequireStudent() {
  const { user, role, profileError, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen label="Recuperando tu sesión…" />

  if (!user) {
    return (
      <Navigate
        to="/estudiante/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (profileError || !role) return <AccountAccessError />

  if (role !== 'student') {
    return <Navigate to="/profesor" replace />
  }

  return <Outlet />
}
