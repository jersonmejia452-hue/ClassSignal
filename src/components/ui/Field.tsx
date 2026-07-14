import type { ReactNode } from 'react'

interface FieldProps {
  children: ReactNode
  label: string
  htmlFor: string
  error?: string
  hint?: string
}

export function Field({
  children,
  label,
  htmlFor,
  error,
  hint,
}: FieldProps) {
  const descriptionId = error
    ? `${htmlFor}-error`
    : hint
      ? `${htmlFor}-hint`
      : undefined

  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-sm font-medium text-red-700" id={descriptionId}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-sm leading-5 text-slate-500" id={descriptionId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
