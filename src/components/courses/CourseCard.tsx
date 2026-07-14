import { ArrowUpRight, BookOpen, RadioTower } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { ClassSession, Course } from '../../types/domain'

const accents = [
  { line: 'bg-[#315cf6]', soft: 'bg-blue-50 text-blue-700' },
  { line: 'bg-[#16b8a6]', soft: 'bg-teal-50 text-teal-700' },
  { line: 'bg-[#7257e8]', soft: 'bg-violet-50 text-violet-700' },
  { line: 'bg-[#e7942d]', soft: 'bg-amber-50 text-amber-700' },
]

interface CourseCardProps {
  course: Course
  sessions: ClassSession[]
}

export function CourseCard({ course, sessions }: CourseCardProps) {
  const accent = accents[course.name.charCodeAt(0) % accents.length]!
  const activeCount = sessions.filter((session) => session.is_active).length

  return (
    <article className="group relative flex min-h-72 flex-col overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(7,26,43,0.055)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_42px_rgba(7,26,43,0.09)] sm:p-6">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent.line}`} aria-hidden="true" />

      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-11 place-items-center rounded-xl ${accent.soft}`}>
          <BookOpen className="size-5" aria-hidden="true" />
        </span>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {activeCount} {activeCount === 1 ? 'clase activa' : 'clases activas'}
          </span>
        )}
      </div>

      <div className="mt-5 flex-1">
        <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700 uppercase">
          {course.subject}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#071a2b]">
          {course.name}
        </h2>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
          {course.description || 'Organiza aquí las clases y señales de este curso.'}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <RadioTower className="size-4" aria-hidden="true" />
          {sessions.length} {sessions.length === 1 ? 'clase creada' : 'clases creadas'}
        </p>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-extrabold text-[#315cf6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to={`/profesor/curso/${course.id}`}
        >
          Abrir curso
          <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
