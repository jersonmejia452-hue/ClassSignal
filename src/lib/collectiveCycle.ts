import {
  understandingStatuses,
  type StudentResponse,
  type UnderstandingStatus,
} from '../types/domain'

export type CollectiveCycleState = 'waiting' | 'compared'

export type CollectiveCycleOutcome =
  | 'neutral'
  | 'improved'
  | 'stable'
  | 'follow_up'

export type CollectiveResponse = Pick<StudentResponse, 'status'>

export type CollectiveStatusValues = Record<UnderstandingStatus, number>

export interface CollectivePulseSnapshot {
  responseCount: number
  counts: CollectiveStatusValues
  percentages: CollectiveStatusValues
}

export interface CollectiveCycleComparison {
  state: CollectiveCycleState
  outcome: CollectiveCycleOutcome
  before: CollectivePulseSnapshot
  after: CollectivePulseSnapshot
  deltaPercentagePoints: Record<UnderstandingStatus, number | null>
}

function emptyStatusValues(): CollectiveStatusValues {
  return {
    understood: 0,
    question: 0,
    lost: 0,
  }
}

function percentage(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100)
}

function buildSnapshot(
  responses: readonly CollectiveResponse[],
): CollectivePulseSnapshot {
  const counts = responses.reduce<CollectiveStatusValues>(
    (current, response) => ({
      ...current,
      [response.status]: current[response.status] + 1,
    }),
    emptyStatusValues(),
  )

  const percentages = understandingStatuses.reduce<CollectiveStatusValues>(
    (current, status) => ({
      ...current,
      [status]: percentage(counts[status], responses.length),
    }),
    emptyStatusValues(),
  )

  return {
    responseCount: responses.length,
    counts,
    percentages,
  }
}

function getOutcome(
  understoodDelta: number,
  lostDelta: number,
): Exclude<CollectiveCycleOutcome, 'neutral'> {
  if (understoodDelta === 0 && lostDelta === 0) return 'stable'

  const understoodDidNotDecrease = understoodDelta >= 0
  const lostDidNotIncrease = lostDelta <= 0
  const atLeastOneKeyMeasureImproved = understoodDelta > 0 || lostDelta < 0

  return understoodDidNotDecrease
    && lostDidNotIncrease
    && atLeastOneKeyMeasureImproved
    ? 'improved'
    : 'follow_up'
}

/**
 * Compares two collective pulse snapshots. Each pulse keeps its own population
 * and denominator; response or student identifiers are never inspected or paired.
 */
export function buildCollectiveCycleComparison(
  beforeResponses: readonly CollectiveResponse[],
  afterResponses: readonly CollectiveResponse[],
): CollectiveCycleComparison {
  const before = buildSnapshot(beforeResponses)
  const after = buildSnapshot(afterResponses)
  const canCompare = before.responseCount > 0 && after.responseCount > 0

  const deltaPercentagePoints = understandingStatuses.reduce<
    CollectiveCycleComparison['deltaPercentagePoints']
  >(
    (current, status) => ({
      ...current,
      [status]: canCompare
        ? after.percentages[status] - before.percentages[status]
        : null,
    }),
    {
      understood: null,
      question: null,
      lost: null,
    },
  )

  const outcome = canCompare
    ? getOutcome(
        deltaPercentagePoints.understood ?? 0,
        deltaPercentagePoints.lost ?? 0,
      )
    : 'neutral'

  return {
    state: after.responseCount === 0 ? 'waiting' : 'compared',
    outcome,
    before,
    after,
    deltaPercentagePoints,
  }
}
