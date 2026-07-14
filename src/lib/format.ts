import type {
  StatusSummaryItem,
  StudentResponse,
  UnderstandingStatus,
} from '../types/domain'

export const statusContent: Record<
  UnderstandingStatus,
  { label: string; shortLabel: string; description: string }
> = {
  understood: {
    label: 'Entendí',
    shortLabel: 'Entendí',
    description: 'Puedo seguir el tema y explicarlo con mis palabras.',
  },
  question: {
    label: 'Tengo una duda',
    shortLabel: 'Con dudas',
    description: 'Sigo la idea general, pero necesito aclarar algo.',
  },
  lost: {
    label: 'Estoy perdido',
    shortLabel: 'Perdidos',
    description: 'Necesito que retomemos el tema desde otro punto.',
  },
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateTime(value: string) {
  return dateFormatter.format(new Date(value))
}

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value))
}

export function buildStatusSummary(
  responses: StudentResponse[],
): StatusSummaryItem[] {
  const total = responses.length
  const counts: Record<UnderstandingStatus, number> = {
    understood: 0,
    question: 0,
    lost: 0,
  }

  responses.forEach((response) => {
    counts[response.status] += 1
  })

  return (Object.keys(counts) as UnderstandingStatus[]).map((status) => ({
    status,
    count: counts[status],
    percentage: total === 0 ? 0 : Math.round((counts[status] / total) * 100),
  }))
}
