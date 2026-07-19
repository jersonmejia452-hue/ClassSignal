import { useRef, type KeyboardEvent } from 'react'
import {
  BrainCircuit,
  FileCheck2,
  MessageCircleQuestion,
  RadioTower,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '../../lib/cn'

export type SessionWorkspacePanel = 'live' | 'questions' | 'analysis' | 'publication'

interface SessionWorkspaceNavProps {
  activePanel: SessionWorkspacePanel
  liveResponseCount: number
  onChange: (panel: SessionWorkspacePanel) => void
  publicationStatus: string
  questionCount: number
}

interface WorkspaceItem {
  icon: LucideIcon
  id: SessionWorkspacePanel
  label: string
}

const workspaceItems: WorkspaceItem[] = [
  { icon: RadioTower, id: 'live', label: 'En vivo' },
  { icon: MessageCircleQuestion, id: 'questions', label: 'Dudas' },
  { icon: BrainCircuit, id: 'analysis', label: 'Análisis' },
  { icon: FileCheck2, id: 'publication', label: 'Publicar' },
]

export function SessionWorkspaceNav({
  activePanel,
  liveResponseCount,
  onChange,
  publicationStatus,
  questionCount,
}: SessionWorkspaceNavProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const getStatus = (panel: SessionWorkspacePanel) => {
    if (panel === 'live') {
      return `${liveResponseCount} ${liveResponseCount === 1 ? 'señal' : 'señales'}`
    }
    if (panel === 'questions') {
      return `${questionCount} ${questionCount === 1 ? 'duda' : 'dudas'}`
    }
    if (panel === 'analysis') return 'Mapa IA'
    return publicationStatus
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % workspaceItems.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + workspaceItems.length) % workspaceItems.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = workspaceItems.length - 1
    } else {
      return
    }

    event.preventDefault()
    const nextPanel = workspaceItems[nextIndex]!.id
    onChange(nextPanel)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="sticky top-[5.45rem] z-30 mt-6 rounded-2xl border border-slate-200/90 bg-[#f4f7fb]/95 p-2 shadow-[0_14px_35px_rgba(7,26,43,0.08)] backdrop-blur-xl">
      <div aria-label="Vista de la clase" className="grid grid-cols-4 gap-1" role="tablist">
        {workspaceItems.map((item, index) => {
          const Icon = item.icon
          const isActive = activePanel === item.id

          return (
            <button
              aria-controls={`session-workspace-panel-${item.id}`}
              aria-selected={isActive}
              className={cn(
                'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-h-14 sm:flex-row sm:justify-start sm:gap-2 sm:px-4 sm:text-left',
                isActive
                  ? 'bg-[#071a2b] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-950',
              )}
              id={`session-workspace-tab-${item.id}`}
              key={item.id}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => {
                buttonRefs.current[index] = element
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <Icon className={cn('size-4 shrink-0', isActive ? 'text-[#66e2d1]' : 'text-blue-700')} aria-hidden="true" />
              <span className="min-w-0 max-w-full">
                <span className="block truncate text-sm font-extrabold">{item.label}</span>
                <span className={cn('block truncate text-[0.62rem] font-semibold sm:text-xs', isActive ? 'text-slate-300' : 'text-slate-500')}>
                  {getStatus(item.id)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
