import { useState } from 'react'
import { LayoutDashboard, LogOut, Plus } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/cn'
import { getErrorMessage } from '../../lib/errors'
import { Alert } from '../ui/Alert'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300',
    isActive
      ? 'bg-white/12 text-white'
      : 'text-blue-100 hover:bg-white/8 hover:text-white',
  )

export function ProfessorLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setError(null)

    try {
      await signOut()
      navigate('/profesor/login', { replace: true })
    } catch (signOutError) {
      setError(getErrorMessage(signOutError, 'No pudimos cerrar la sesión.'))
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0b1830] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <Brand inverse to="/profesor" />

          <div className="flex items-center gap-1 sm:gap-2">
            <nav className="flex items-center" aria-label="Navegación del profesor">
              <NavLink className={navLinkClass} end to="/profesor">
                <LayoutDashboard className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Sesiones</span>
              </NavLink>
              <NavLink className={navLinkClass} to="/profesor/sesiones/nueva">
                <Plus className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Nueva sesión</span>
              </NavLink>
            </nav>

            <div className="mx-1 hidden h-7 w-px bg-white/15 md:block" />
            <span className="hidden max-w-48 truncate text-xs font-medium text-blue-100 md:block">
              {user?.email}
            </span>
            <Button
              aria-label="Cerrar sesión"
              className="min-h-11 px-3 text-blue-100 hover:bg-white/10 hover:text-white"
              disabled={isSigningOut}
              onClick={handleSignOut}
              variant="ghost"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="sr-only">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
