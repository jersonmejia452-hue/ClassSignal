import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Brand } from '../components/ui/Brand'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <div className="max-w-lg text-center">
        <div className="flex justify-center">
          <Brand to="/profesor" />
        </div>
        <p className="mt-12 text-sm font-extrabold tracking-[0.18em] text-blue-700 uppercase">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950">
          Esta página no existe
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          Revisa el enlace o vuelve al panel para continuar.
        </p>
        <Link className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800" to="/profesor">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al panel
        </Link>
      </div>
    </main>
  )
}
