import { useCallback, useEffect, useState } from 'react'
import { CalendarPlus2, Plus, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SessionCard } from '../../components/sessions/SessionCard'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../lib/errors'
import { getMySessions } from '../../services/sessions.service'
import type { ClassSession } from '../../types/domain'

export function DashboardPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)
    try {
      setSessions(await getMySessions(user.id))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No pudimos cargar tus sesiones.'))
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const activeCount = sessions.filter((session) => session.is_active).length

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
            Panel docente
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Tus sesiones de clase
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Crea un pulso de comprensión, comparte el código y observa las respuestas mientras llegan.
          </p>
        </div>
        <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to="/profesor/sesiones/nueva">
          <Plus className="size-4" aria-hidden="true" />
          Nueva sesión
        </Link>
      </div>

      {!isLoading && sessions.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-slate-600">
            <strong className="text-slate-950">{activeCount}</strong> {activeCount === 1 ? 'sesión activa' : 'sesiones activas'} de {sessions.length}
          </p>
          <Button className="min-h-10 px-3" disabled={isLoading} onClick={() => void loadSessions()} variant="ghost">
            <RefreshCw className="size-4" aria-hidden="true" />
            Actualizar
          </Button>
        </div>
      )}

      {error && (
        <Alert className="mt-7" tone="error">
          {error}
          <button className="ml-1 font-extrabold underline underline-offset-2" onClick={() => void loadSessions()} type="button">
            Reintentar
          </button>
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Cargando sesiones" role="status">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" key={index} />
          ))}
        </div>
      ) : sessions.length === 0 && !error ? (
        <div className="mt-8">
          <EmptyState
            action={(
              <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-800" to="/profesor/sesiones/nueva">
                <Plus className="size-4" aria-hidden="true" />
                Crear mi primera sesión
              </Link>
            )}
            icon={<CalendarPlus2 className="size-5" aria-hidden="true" />}
            title="Todavía no tienes sesiones"
          >
            Empieza con una clase real. Solo necesitas un título, una materia y el tema que estás explicando.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
