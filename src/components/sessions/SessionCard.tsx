import { ArrowRight, BookOpen, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDateTime } from '../../lib/format'
import type { ClassSession } from '../../types/domain'
import { SessionStatusBadge } from './SessionStatusBadge'

export function SessionCard({ session }: { session: ClassSession }) {
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <SessionStatusBadge isActive={session.is_active} />
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-extrabold tracking-[0.12em] text-slate-700">
          {session.code}
        </span>
      </div>

      <div className="mt-5 flex-1">
        <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.12em] text-blue-700 uppercase">
          <BookOpen className="size-4" aria-hidden="true" />
          {session.subject}
        </p>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-950">
          {session.title}
        </h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {session.topic}
        </p>
      </div>

      <div className="mt-6 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatDateTime(session.created_at)}
        </p>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-extrabold text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to={`/profesor/sesion/${session.id}`}
        >
          Ver panel
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
