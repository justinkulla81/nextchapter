/**
 * Which O*NET occupations the taxonomy holds. We cover white-collar work, mid-career to
 * executive, because that is who NextChapter serves: loading all ~900 occupations would only add
 * trades, retail and service work we have no tools for, and make every comparison slower and noisier.
 *
 * An occupation is in scope when its SOC group is a professional one AND O*NET puts it in Job
 * Zone 4 or 5 (a bachelor's degree or more, and considerable preparation). The group list below
 * is a judgment call; edit it here and re-run the O*NET import with `--prune`.
 */

/** Whole SOC major groups: Management, Business and Financial, Computer and Mathematical, Legal. */
export const SCOPE_MAJOR_GROUPS = ['11', '13', '15', '23'] as const

/**
 * Professional minor groups inside majors we otherwise leave out:
 *   17-1 architects and surveyors, 17-2 engineers (not 17-3 drafters and technicians)
 *   27-1 art and design (art directors, designers), 27-3 media and communication (PR, writers, editors)
 *   41-1 sales supervisors, 41-3 sales reps of services, 41-4 sales reps of products, 41-9 other sales
 *   (not 41-2 retail sales). The Job Zone test then drops retail supervisors and the like.
 */
export const SCOPE_MINOR_GROUPS = ['17-1', '17-2', '27-1', '27-3', '41-1', '41-3', '41-4', '41-9'] as const

export const SCOPE_MIN_JOB_ZONE = 4

export function inScopeBySoc(socCode: string): boolean {
  const major = socCode.slice(0, 2)
  if ((SCOPE_MAJOR_GROUPS as readonly string[]).includes(major)) return true
  return (SCOPE_MINOR_GROUPS as readonly string[]).includes(socCode.slice(0, 4))
}

/** An occupation with no Job Zone has no preparation level to judge, so it is out. */
export function inWhiteCollarScope(socCode: string, jobZone: number | null | undefined): boolean {
  return inScopeBySoc(socCode) && typeof jobZone === 'number' && jobZone >= SCOPE_MIN_JOB_ZONE
}

export type ImportScope = 'white-collar' | 'all'
