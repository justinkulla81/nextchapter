export const GAP_THRESHOLD_MONTHS = 2
export const SHORT_TENURE_MONTHS = 12

// Prefers firstJobStartDate (more direct); falls back to graduationDate as
// a reasonable proxy when the resume doesn't clearly show a first job.
// Returns null if neither is available, leaving yearsExperience for manual
// confirmation instead of guessing.
export function computeYearsExperienceFromResume(
  graduationDate: Date | null,
  firstJobStartDate: Date | null,
  asOf: Date = new Date()
): number | null {
  const start = firstJobStartDate ?? graduationDate
  if (!start) return null
  const months = Math.max(
    0,
    (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth())
  )
  return Math.round(months / 12)
}

export interface WorkHistoryEntryInput {
  companyName: string
  roleTitle: string
  startDate: Date
  endDate: Date | null
  isCurrent: boolean
  departureReason: string | null
}

export interface EmploymentGap {
  afterCompany: string
  afterRole: string
  gapMonths: number
  precedingDepartureReason: string | null
}

export interface WorkHistoryAnalysis {
  roleCount: number
  gaps: EmploymentGap[]
  shortTenureCount: number
  averageTenureMonths: number | null
}

function monthsBetween(start: Date, end: Date): number {
  return Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  )
}

export function computeWorkHistoryFacts(
  workHistory: WorkHistoryEntryInput[],
  asOf: Date = new Date()
): WorkHistoryAnalysis {
  const sorted = [...workHistory].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const gaps: EmploymentGap[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]
    const currentEnd = current.isCurrent ? asOf : (current.endDate ?? asOf)
    const gapMonths = monthsBetween(currentEnd, next.startDate)
    if (gapMonths >= GAP_THRESHOLD_MONTHS) {
      gaps.push({
        afterCompany: current.companyName,
        afterRole: current.roleTitle,
        gapMonths,
        precedingDepartureReason: current.departureReason,
      })
    }
  }

  const completedRoles = sorted.filter((entry) => !entry.isCurrent)
  const tenures = completedRoles.map((entry) =>
    monthsBetween(entry.startDate, entry.endDate ?? asOf)
  )
  const shortTenureCount = tenures.filter((months) => months < SHORT_TENURE_MONTHS).length
  const averageTenureMonths =
    tenures.length > 0 ? tenures.reduce((sum, months) => sum + months, 0) / tenures.length : null

  return {
    roleCount: sorted.length,
    gaps,
    shortTenureCount,
    averageTenureMonths,
  }
}
