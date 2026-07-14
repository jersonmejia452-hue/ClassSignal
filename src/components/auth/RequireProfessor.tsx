import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { LoadingScreen } from '../ui/LoadingScreen'

export function RequireProfessor() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen label="Recuperando tu sesión…" />

  if (!user) {
    return <Navigate to="/profesor/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
