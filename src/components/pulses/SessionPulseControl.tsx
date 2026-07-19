import { useState } from 'react'
import { ArrowRight, LockKeyhole, RadioTower, RefreshCw } from 'lucide-react'

import { formatTime } from '../../lib/format'
import { maximumSessionPulseCount } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { PulseStatusBadge } from './PulseStatusBadge'

interface SessionPulseControlProps {
  activePulseOrdinal?: number
  activePulseStartedAt?: string
  activeResponseCount: number
  error: string | null
  isLoading: boolean
  isOpening: boolean
  isSessionActive: boolean
  onOpenNext: () => unknown | Promise<unknown>
  onRetry: () => unknown | Promise<unknown>
  pulseCount: number
}

export function SessionPulseControl({
  activePulseOrdinal,
  activePulseStartedAt,
  activeResponseCount,
  error,
  isLoading,
  isOpening,
  isSessionActive,
  onOpenNext,
  onRetry,
  pulseCount,
}: SessionPulseControlProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const hasActivePulse = activePulseOrdinal !== undefined
  const hasReachedLimit = pulseCount >= maximumSessionPulseCount
  const needsFirstResponse = !isLoading && hasActivePulse && activeResponseCount === 0
  const nextOrdinal = pulseCount + 1
  const canOpen = isSessionActive
    && !isLoading
    && !isOpening
    && !hasReachedLimit
    && !needsFirstResponse

  const confirmOpen = async () => {
    await onOpenNext()
    setIsConfirming(false)
  }

  return (
    <section
      aria-labelledby="session-pulse-control-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <RadioTower className="size-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-slate-950" id="session-pulse-control-title">
            Pulsos
          </h2>
        </div>
        <span className="text-xs font-extrabold text-slate-500">
          {pulseCount}/{maximumSessionPulseCount}
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div>
          {hasActivePulse ? (
            <>
              <PulseStatusBadge isActive ordinal={activePulseOrdinal} />
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Abrir otro pulso conserva este resultado y permite responder de nuevo.
              </p>
              <p className="mt-1 text-sm font-extrabold text-slate-900" aria-live="polite">
                {activeResponseCount} {activeResponseCount === 1 ? 'señal recibida' : 'señales recibidas'}
                {activePulseStartedAt ? ` · inició a las ${formatTime(activePulseStartedAt)}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className="font-extrabold text-slate-950">
                {pulseCount === 0 ? 'Abre el primer pulso de la clase' : 'No hay un pulso activo'}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                El código y el QR no cambian.
              </p>
            </>
          )}
        </div>

        <Button
          className="min-w-48"
          disabled={!canOpen}
          isLoading={isOpening}
          onClick={() => setIsConfirming(true)}
        >
          {pulseCount === 0 ? 'Abrir primer pulso' : 'Abrir nuevo pulso'}
          {!isOpening && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
      </div>

      {isConfirming && (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-amber-950">
                ¿Abrir el pulso {nextOrdinal}?
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                {hasActivePulse
                  ? `El pulso ${activePulseOrdinal} quedará cerrado y los estudiantes podrán responder nuevamente.`
                  : 'Los estudiantes podrán enviar una señal anónima desde el enlace actual.'}
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button disabled={isOpening} onClick={() => setIsConfirming(false)} variant="ghost">
                  Cancelar
                </Button>
                <Button disabled={!canOpen} isLoading={isOpening} onClick={() => void confirmOpen()}>
                  Sí, abrir pulso {nextOrdinal}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isSessionActive && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert>Reactiva la clase antes de abrir otro pulso.</Alert>
        </div>
      )}
      {needsFirstResponse && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert>Recibe al menos una señal en el pulso actual antes de abrir el siguiente.</Alert>
        </div>
      )}
      {hasReachedLimit && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert>Esta clase alcanzó el máximo de seis pulsos.</Alert>
        </div>
      )}
      {error && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert tone="error">
            {error}{' '}
            <button className="font-extrabold underline underline-offset-2" onClick={() => void onRetry()} type="button">
              <RefreshCw className="mr-1 inline size-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </Alert>
        </div>
      )}
    </section>
  )
}
