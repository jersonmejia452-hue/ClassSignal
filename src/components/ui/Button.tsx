import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  isLoading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#315cf6] text-white shadow-[0_8px_22px_rgba(49,92,246,0.18)] hover:bg-[#254bd4] active:bg-[#1e3eaf] disabled:bg-blue-300 disabled:shadow-none',
  secondary:
    'border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  danger:
    'border border-red-200 bg-red-50 text-red-800 hover:border-red-300 hover:bg-red-100',
}

export function Button({
  children,
  className,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70',
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
