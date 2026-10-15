// Which O*NET occupations the skills layer covers: white-collar management and
// professional work. This is an occupation filter, not a seniority one. O*NET
// describes the occupation, so a "Financial Analyst" and a "VP Finance" can both be
// in scope; level comes from the member's calibrated level rank
// (src/lib/scoring/level-rank.ts), never from here.

/** SOC prefixes in scope. Broad groups are whole major groups; narrower ones are one minor group. */
export const TARGET_SOC_PREFIXES = [
  '11-', // Management
  '13-', // Business and financial operations
  '15-', // Computer and mathematical
  '23-', // Legal
  '17-2', // Engineers
  '27-1', // Designers
  '27-3', // Media and communication
  '41-3', // Advertising, insurance, securities and other sales agents
  '41-4', // Sales representatives, services and wholesale
  '41-9', // Other sales (e.g. sales engineers)
] as const

/** Lowest O*NET Job Zone in scope: 4 is bachelor's-level preparation, 5 is graduate-level. */
export const MIN_JOB_ZONE = 4

/**
 * True for a white-collar professional or management occupation. An occupation with no
 * Job Zone is out: we can't tell it clears the bar, and claiming so would be a guess.
 */
export function isTargetOccupation(socCode: string, jobZone: number | null | undefined): boolean {
  if (typeof jobZone !== 'number' || jobZone < MIN_JOB_ZONE) return false
  return TARGET_SOC_PREFIXES.some((p) => socCode.startsWith(p))
}

/** "11-2021.00" -> "11-2021". Passes a 6-digit code through; returns null when it isn't a SOC code. */
export function toSocCode(code: string): string | null {
  const m = /^(\d{2})-?(\d{4})(?:\.\d{2})?$/.exec(code.trim())
  return m ? `${m[1]}-${m[2]}` : null
}
