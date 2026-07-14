import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  children: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-extrabold tracking-tight text-slate-950">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
