import { useState } from 'react'
import { BookOpenCheck, LogOut, Plus } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/cn'
import { getErrorMessage } from '../../lib/errors'
import { Alert } from '../ui/Alert'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66e2d1]',
    isActive
      ? 'bg-white text-[#071a2b] shadow-sm'
      : 'text-slate-300 hover:bg-white/8 hover:text-white',
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
    <div className="signal-shell min-h-screen bg-[#f4f7fb]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071a2b]/96 text-white shadow-[0_8px_30px_rgba(7,26,43,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.75rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Brand inverse to="/profesor" />

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <nav className="flex items-center gap-1" aria-label="Navegación del profesor">
              <NavLink className={navLinkClass} end to="/profesor">
                <BookOpenCheck className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Mis cursos</span>
              </NavLink>
              <NavLink className={navLinkClass} to="/profesor/cursos/nuevo">
                <Plus className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Nuevo curso</span>
              </NavLink>
            </nav>

            <div className="mx-1 hidden h-7 w-px bg-white/15 lg:block" />
            <span className="hidden max-w-40 truncate text-xs font-semibold text-slate-400 lg:block xl:max-w-56">
              {user?.email}
            </span>
            <Button
              aria-label="Cerrar sesión"
              className="min-h-11 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
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

      <main className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <Outlet />
      </main>
    </div>
  )
}
