import { Settings2 } from 'lucide-react'

import { envIssues } from '../lib/env'
import { Brand } from '../components/ui/Brand'

export function ConfigurationPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <Brand to="/" />
        <div className="mt-9 grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Settings2 className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
          Configuración pendiente
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          Conecta tu proyecto de Supabase
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          Copia <code>.env.example</code> como <code>.env.local</code> y completa la URL y la
          clave pública del proyecto. Nunca uses una clave secreta en esta aplicación.
        </p>

        {envIssues.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">Variables por revisar</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {envIssues.map((issue) => (
                <li key={`${issue.field}-${issue.message}`}>
                  <code>{issue.field || 'entorno'}</code>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  )
}
