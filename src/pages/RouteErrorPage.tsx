import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Link, useRouteError } from 'react-router-dom'

import { Brand } from '../components/ui/Brand'
import { Button } from '../components/ui/Button'

export function RouteErrorPage() {
  const error = useRouteError()

  useEffect(() => {
    console.error('ClassSignal route error', error)
  }, [error])

  return (
    <main className="signal-shell grid min-h-screen place-items-center bg-[#f4f7fb] px-5 py-10">
      <section className="w-full max-w-lg rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_55px_rgba(7,26,43,0.09)] sm:p-9">
        <div className="flex justify-center">
          <Brand to="/" />
        </div>
        <span className="mx-auto mt-8 grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-[#071a2b] sm:text-3xl">
          La navegación se interrumpió
        </h1>
        <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
          Tu sesión sigue segura. Recarga la aplicación para continuar desde el último punto.
        </p>
        <Button className="mt-7" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Volver a intentar
        </Button>
        <div className="mt-4">
          <Link className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-extrabold text-blue-700 hover:bg-blue-50" to="/profesor">
            Ir al inicio docente
          </Link>
        </div>
      </section>
    </main>
  )
}
