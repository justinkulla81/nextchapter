import type { CrmLeadQuality } from '@prisma/client'

/**
 * How an employer organization is graded, from two signals:
 *   A  it has a layoff notice (the outplacement and CHRO pitch)
 *   B  it has more than OPENINGS_THRESHOLD open jobs right now (the hiring pitch)
 *   C  neither
 * The grade only ever goes up, and only when the nightly job set it (or nobody has
 * graded the organization yet). A grade set by hand is never touched.
 */
export const OPENINGS_THRESHOLD = 5

export type AutoGrade = 'A' | 'B' | 'C'

export interface GradeSignals { hasLayoffNotice: boolean; openNow: number }

export function targetGrade(s: GradeSignals): AutoGrade {
  if (s.hasLayoffNotice) return 'A'
  if (s.openNow > OPENINGS_THRESHOLD) return 'B'
  return 'C'
}

const RANK: Record<CrmLeadQuality, number> = { UNGRADED: 0, D: 0, C: 1, B: 2, A: 3 }

/** The job may change this grade: it is ungraded, or the job set it itself. */
export function mayAutoGrade(current: CrmLeadQuality, setBy: string | null): boolean {
  return current === 'UNGRADED' || setBy === 'AUTO'
}

/** The grade to write, or null to leave the organization as it is. */
export function nextGrade(current: CrmLeadQuality, setBy: string | null, signals: GradeSignals): AutoGrade | null {
  if (!mayAutoGrade(current, setBy)) return null
  const target = targetGrade(signals)
  return RANK[target] > RANK[current] ? target : null
}
