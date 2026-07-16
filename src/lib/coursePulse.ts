import type { CoursePulsePoint } from '../types/domain'

export type CoursePulseTrend = 'up' | 'down' | 'stable'

export interface CoursePulseDistribution {
  understood: number
  question: number
  lost: number
}

export interface CoursePulseMetrics {
  measuredSessions: number
  totalResponses: number
  weightedDistribution: CoursePulseDistribution
  latestUnderstoodPercentage: number | null
  trendDelta: number | null
  trend: CoursePulseTrend | null
}

function percentage(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100)
}

export function getCoursePulseDistribution(
  point: CoursePulsePoint,
): CoursePulseDistribution {
  return {
    understood: percentage(point.understood_count, point.response_count),
    question: percentage(point.question_count, point.response_count),
    lost: percentage(point.lost_count, point.response_count),
  }
}

export function buildCoursePulseMetrics(
  points: readonly CoursePulsePoint[],
): CoursePulseMetrics {
  const measuredPoints = points
    .filter((point) => point.response_count > 0)
    .sort((first, second) => (
      Date.parse(first.created_at) - Date.parse(second.created_at)
    ))

  const totals = measuredPoints.reduce(
    (current, point) => ({
      responses: current.responses + point.response_count,
      understood: current.understood + point.understood_count,
      question: current.question + point.question_count,
      lost: current.lost + point.lost_count,
    }),
    { responses: 0, understood: 0, question: 0, lost: 0 },
  )

  const latest = measuredPoints.at(-1)
  const previous = measuredPoints.at(-2)
  const latestUnderstoodPercentage = latest
    ? getCoursePulseDistribution(latest).understood
    : null
  const previousUnderstoodPercentage = previous
    ? getCoursePulseDistribution(previous).understood
    : null
  const trendDelta = latestUnderstoodPercentage !== null
    && previousUnderstoodPercentage !== null
    ? latestUnderstoodPercentage - previousUnderstoodPercentage
    : null

  return {
    measuredSessions: measuredPoints.length,
    totalResponses: totals.responses,
    weightedDistribution: {
      understood: percentage(totals.understood, totals.responses),
      question: percentage(totals.question, totals.responses),
      lost: percentage(totals.lost, totals.responses),
    },
    latestUnderstoodPercentage,
    trendDelta,
    trend: trendDelta === null
      ? null
      : trendDelta > 0
        ? 'up'
        : trendDelta < 0
          ? 'down'
          : 'stable',
  }
}
