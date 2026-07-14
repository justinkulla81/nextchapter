// Detects when a candidate's problem has stopped being effort and started
// being strategy — 3+ consecutive A weeks in Search Execution with
// near-zero market response is a signal that more of the same won't help,
// independent of the regular Week 4/8/13 scheduled reviews.

import type { HireabilityGrade } from '@/lib/scoring/grade'
import type { MarketResponseSnapshot } from '@/lib/reports/market-response'

export interface StrategicCheckpointReportInput {
  gradeSnapshot: HireabilityGrade
  marketResponse: MarketResponseSnapshot | null
}

export type StraightTalkMode = 'tactical' | 'strategic'

export interface StrategicCheckpointResult {
  flag: string | null
  straightTalkMode: StraightTalkMode
}

export function evaluateStrategicCheckpoint(
  weekNumber: number,
  recentReports: StrategicCheckpointReportInput[]
): StrategicCheckpointResult {
  // Immediate trigger: 3+ consecutive A weeks with near-zero market response.
  const lastThree = recentReports.slice(-3)
  const allA =
    lastThree.length === 3 && lastThree.every((r) => r.gradeSnapshot.searchExecution.grade === 'A')
  const totalSignals = lastThree.reduce((sum, r) => {
    const mr = r.marketResponse
    return sum + (mr?.conversations ?? 0) + (mr?.interviews ?? 0) + (mr?.paidProjectLeads ?? 0)
  }, 0)

  if (allA && totalSignals < 2) {
    return { flag: 'triggered', straightTalkMode: 'strategic' }
  }

  // Scheduled checkpoints.
  if (weekNumber === 4) return { flag: 'week4_review', straightTalkMode: 'tactical' }
  if (weekNumber === 8) return { flag: 'week8_review', straightTalkMode: 'tactical' }
  if (weekNumber === 13) return { flag: 'week13_full', straightTalkMode: 'tactical' }

  return { flag: null, straightTalkMode: 'tactical' }
}
