import { Check } from 'lucide-react'

import { cn } from '../../lib/cn'

export const demoSteps = [
  {
    id: 'student-signal',
    label: 'Señal estudiantil',
    shortLabel: 'Responde',
  },
  {
    id: 'live-pulse',
    label: 'Pulso docente',
    shortLabel: 'Observa',
  },
  {
    id: 'confusion-map',
    label: 'Mapa de confusión',
    shortLabel: 'Interpreta',
  },
  {
    id: 'course-history',
    label: 'Historia del curso',
    shortLabel: 'Compara',
  },
] as const

export type DemoStepId = (typeof demoSteps)[number]['id']

interface DemoProgressProps {
  currentStep: number
  className?: string
}

export function DemoProgress({
  currentStep,
  className,
}: DemoProgressProps) {
  const safeCurrentStep = Math.max(
    0,
    Math.min(currentStep, demoSteps.length - 1),
  )
  const current = demoSteps[safeCurrentStep]!
  const percentage = ((safeCurrentStep + 1) / demoSteps.length) * 100

  return (
    <nav
      aria-label="Progreso de la demostración"
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <div className="flex items-end justify-between gap-4 sm:hidden">
        <div>
          <p className="text-xs font-extrabold tracking-[0.13em] text-blue-700 uppercase">
            Paso {safeCurrentStep + 1} de {demoSteps.length}
          </p>
          <p className="mt-1 font-extrabold text-[#071a2b]">{current.label}</p>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {Math.round(percentage)}%
        </span>
      </div>

      <div
        aria-label={`Paso ${safeCurrentStep + 1} de ${demoSteps.length}: ${current.label}`}
        aria-valuemax={demoSteps.length}
        aria-valuemin={1}
        aria-valuenow={safeCurrentStep + 1}
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 sm:hidden"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-[#315cf6] transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <ol className="hidden grid-cols-4 sm:grid">
        {demoSteps.map((step, index) => {
          const isCurrent = index === safeCurrentStep
          const isCompleted = index < safeCurrentStep

          return (
            <li
              aria-current={isCurrent ? 'step' : undefined}
              className="relative min-w-0 px-2 first:pl-0 last:pr-0"
              key={step.id}
            >
              {index > 0 && (
                <span
                  className={cn(
                    'absolute top-5 right-[calc(50%+1.25rem)] left-[calc(-50%+1.25rem)] h-0.5',
                    isCompleted || isCurrent ? 'bg-blue-600' : 'bg-slate-200',
                  )}
                  aria-hidden="true"
                />
              )}

              <div className="relative flex flex-col items-center text-center">
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-full border-2 text-sm font-black',
                    isCurrent
                      ? 'border-blue-700 bg-blue-700 text-white shadow-[0_0_0_4px_rgba(49,92,246,0.12)]'
                      : isCompleted
                        ? 'border-blue-700 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-400',
                  )}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <Check className="size-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    'mt-3 text-xs font-extrabold',
                    isCurrent
                      ? 'text-[#071a2b]'
                      : isCompleted
                        ? 'text-blue-700'
                        : 'text-slate-500',
                  )}
                >
                  {step.shortLabel}
                </span>
                <span className="mt-0.5 hidden text-[0.7rem] font-semibold text-slate-500 lg:block">
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
