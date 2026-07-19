import { useEffect, useRef, useState } from 'react'
import { Check, Copy, MonitorUp, QrCode, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router-dom'

import { getPublicAppOrigin } from '../../lib/env'
import type { ClassSession } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

export function ShareSessionCard({ session }: { session: ClassSession }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const resetTimer = useRef<number | null>(null)
  const publicUrl = `${getPublicAppOrigin()}/s/${session.code}`

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopyState('copied')
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => {
        setCopyState('idle')
        resetTimer.current = null
      }, 2200)
    } catch {
      setCopyState('error')
    }
  }

  const shareLink = async () => {
    if (!navigator.share) {
      await copyLink()
      return
    }

    try {
      await navigator.share({
        title: `${session.title} · ClassSignal`,
        text: `Comparte de forma anónima cómo va tu comprensión de ${session.topic}.`,
        url: publicUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setCopyState('error')
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
          <QrCode className="size-4 text-blue-700" aria-hidden="true" />
          Acceso
        </p>
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          rel="noreferrer"
          target="_blank"
          to={`/profesor/sesion/${session.id}/presentar`}
        >
          <MonitorUp className="size-4" aria-hidden="true" />
          Abrir modo proyector
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[0.13em] text-slate-500 uppercase">Código</p>
          <p className="mt-1 font-mono text-3xl font-black tracking-[0.14em] text-slate-950">
            {session.code}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={copyLink} variant="secondary">
            {copyState === 'copied' ? (
              <Check className="size-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copyState === 'copied' ? 'Copiado' : 'Copiar enlace'}
          </Button>
          <Button onClick={shareLink}>
            <Share2 className="size-4" aria-hidden="true" />
            Compartir
          </Button>
        </div>
      </div>

      <details className="border-t border-slate-100">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-extrabold text-blue-700 marker:text-slate-400 hover:bg-blue-50/60 sm:px-5">
          Ver QR y enlace completo
        </summary>
        <div className="grid gap-5 border-t border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center sm:p-5">
          <p className="break-all text-sm leading-6 text-slate-600">{publicUrl}</p>
          <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:mx-0">
            <QRCodeSVG
              bgColor="#ffffff"
              fgColor="#0b1830"
              level="Q"
              marginSize={1}
              size={120}
              title={`Código QR para la clase ${session.code}`}
              value={publicUrl}
            />
          </div>
        </div>
      </details>

      {copyState === 'error' && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <Alert tone="error">No pudimos compartir el enlace. Cópialo manualmente.</Alert>
        </div>
      )}
    </section>
  )
}
