import { LoaderCircle } from 'lucide-react'

import { Brand } from './Brand'

export function LoadingScreen({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <Brand to="/" />
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600" role="status">
          <LoaderCircle className="size-5 animate-spin text-blue-700" aria-hidden="true" />
          {label}
        </div>
      </div>
    </div>
  )
}
