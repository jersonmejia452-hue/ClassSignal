import { LogOut, ShieldAlert } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { Alert } from '../ui/Alert'
import { Brand } from '../ui/Brand'
import { Button } from '../ui/Button'

export function AccountAccessError() {
  const { signOut } = useAuth()

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fb] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(7,26,43,0.09)] sm:p-8">
        <Brand to="/" />
        <div className="mt-7">
          <Alert title="No pudimos verificar tu perfil" tone="error">
            Cierra la sesión y vuelve a entrar. Si el problema continúa, pide al administrador que revise el rol de tu cuenta.
          </Alert>
        </div>
        <Button
          className="mt-5"
          fullWidth
          onClick={() => void signOut()}
          variant="secondary"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Cerrar sesión
        </Button>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          El acceso falla de forma segura cuando el perfil no está disponible.
        </p>
      </div>
    </main>
  )
}
