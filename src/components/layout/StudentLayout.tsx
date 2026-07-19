import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, LogOut, TicketPlus } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/cn'
import { getErrorMessage } from '../../lib/errors'
import { Alert } from '../ui/Alert'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'

const desktopNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66e2d1]',
    isActive
      ? 'bg-white text-[#071a2b] shadow-sm'
      : 'text-slate-300 hover:bg-white/8 hover:text-white',
  )

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[0.7rem] font-extrabold transition focus-visible:outline-2 focus-visible:outline-blue-600',
    isActive
      ? 'bg-blue-50 text-blue-800'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
  )

export function StudentLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const isInitialRouteRef = useRef(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const section = location.pathname.includes('/clase/')
      ? 'Clase'
      : location.pathname.includes('/curso/')
        ? 'Curso'
        : location.pathname.endsWith('/unirse')
          ? 'Unirme a un curso'
          : 'Mis cursos'
    document.title = `${section} · ClassSignal`

    if (isInitialRouteRef.current) {
      isInitialRouteRef.current = false
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      mainRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [location.pathname])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setError(null)

    try {
      await signOut()
      navigate('/estudiante/login', { replace: true })
    } catch (signOutError) {
      setError(getErrorMessage(signOutError, 'No pudimos cerrar la sesión.'))
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="signal-shell min-h-screen bg-[#f4f7fb]">
      <a
        className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-white px-4 py-3 font-extrabold text-blue-800 shadow-lg focus:not-sr-only"
        href="#student-main-content"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071a2b]/96 text-white shadow-[0_8px_30px_rgba(7,26,43,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.75rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="sm:hidden">
            <Brand compact inverse to="/estudiante" />
          </div>
          <div className="hidden sm:block">
            <Brand inverse to="/estudiante" />
          </div>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Navegación del estudiante">
              <NavLink className={desktopNavLinkClass} end to="/estudiante">
                <BookOpenCheck className="size-4" aria-hidden="true" />
                Mis cursos
              </NavLink>
              <NavLink className={desktopNavLinkClass} to="/estudiante/unirse">
                <TicketPlus className="size-4" aria-hidden="true" />
                Unirme a un curso
              </NavLink>
            </nav>

            <div className="mx-1 hidden h-7 w-px bg-white/15 lg:block" />
            <span className="hidden max-w-40 truncate text-xs font-semibold text-slate-400 lg:block xl:max-w-56">
              {user?.email}
            </span>
            <Button
              aria-label="Cerrar sesión"
              className="min-h-11 px-3 text-slate-300 hover:bg-white/10 hover:text-white"
              isLoading={isSigningOut}
              onClick={() => void handleSignOut()}
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

      <main
        className="relative mx-auto max-w-7xl px-4 pt-7 pb-28 outline-none sm:px-6 sm:py-10 lg:px-8 lg:py-12"
        id="student-main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        <Outlet />
      </main>

      <nav
        aria-label="Navegación principal del estudiante"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(7,26,43,0.09)] backdrop-blur-xl sm:hidden"
      >
        <div className="mx-auto flex max-w-md gap-2">
          <NavLink className={mobileNavLinkClass} end to="/estudiante">
            <BookOpenCheck className="size-5" aria-hidden="true" />
            Mis cursos
          </NavLink>
          <NavLink className={mobileNavLinkClass} to="/estudiante/unirse">
            <TicketPlus className="size-5" aria-hidden="true" />
            Unirme
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
