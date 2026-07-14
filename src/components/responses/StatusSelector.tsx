import { CircleHelp, SearchX, ThumbsUp } from 'lucide-react'

import { cn } from '../../lib/cn'
import { statusContent } from '../../lib/format'
import type { UnderstandingStatus } from '../../types/domain'

interface StatusSelectorProps {
  value: UnderstandingStatus | null
  onChange: (value: UnderstandingStatus) => void
  error?: string
  disabled?: boolean
}

const options: Array<{
  status: UnderstandingStatus
  icon: typeof ThumbsUp
  selectedStyle: string
  iconStyle: string
}> = [
  {
    status: 'understood',
    icon: ThumbsUp,
    selectedStyle: 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-100',
    iconStyle: 'bg-emerald-100 text-emerald-700',
  },
  {
    status: 'question',
    icon: CircleHelp,
    selectedStyle: 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-100',
    iconStyle: 'bg-amber-100 text-amber-700',
  },
  {
    status: 'lost',
    icon: SearchX,
    selectedStyle: 'border-red-500 bg-red-50/80 ring-2 ring-red-100',
    iconStyle: 'bg-red-100 text-red-700',
  },
]

export function StatusSelector({
  value,
  onChange,
  error,
  disabled = false,
}: StatusSelectorProps) {
  return (
    <fieldset aria-describedby={error ? 'status-error' : undefined} disabled={disabled}>
      <legend className="text-base font-extrabold text-slate-950">
        ¿Cómo vas con este tema?
      </legend>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Elige la opción que mejor describe cómo te sientes ahora.
      </p>

      <div className="mt-4 grid gap-3">
        {options.map(({ status, icon: Icon, selectedStyle, iconStyle }) => {
          const selected = value === status
          const content = statusContent[status]

          return (
            <label
              className={cn(
                'relative flex min-h-20 cursor-pointer items-center gap-4 rounded-2xl border bg-white p-4 transition hover:border-slate-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600',
                selected ? selectedStyle : 'border-slate-200',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              key={status}
            >
              <input
                checked={selected}
                className="sr-only"
                name="understanding-status"
                onChange={() => onChange(status)}
                type="radio"
                value={status}
              />
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', iconStyle)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-950">{content.label}</span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                  {content.description}
                </span>
              </span>
              <span
                className={cn(
                  'ml-auto size-5 shrink-0 rounded-full border-2',
                  selected
                    ? 'border-blue-700 bg-blue-700 shadow-[inset_0_0_0_4px_white]'
                    : 'border-slate-300 bg-white',
                )}
                aria-hidden="true"
              />
            </label>
          )
        })}
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-700" id="status-error">
          {error}
        </p>
      )}
    </fieldset>
  )
}
