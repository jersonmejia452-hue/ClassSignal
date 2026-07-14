import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '../../lib/cn'

type AlertTone = 'info' | 'success' | 'error'

interface AlertProps {
  children: ReactNode
  title?: string
  tone?: AlertTone
  className?: string
}

const styles: Record<AlertTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-red-200 bg-red-50 text-red-950',
}

const icons: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
}

export function Alert({
  children,
  title,
  tone = 'info',
  className,
}: AlertProps) {
  const Icon = icons[tone]

  return (
    <div
      className={cn('flex gap-3 rounded-xl border p-4 text-sm', styles[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-bold">{title}</p>}
        <div className={cn(title && 'mt-1', 'leading-6')}>{children}</div>
      </div>
    </div>
  )
}
