import type { EngagementType, CareerTrajectory } from '@prisma/client'
import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'

export const GAP_THRESHOLD_MONTHS = 2
export const SHORT_TENURE_MONTHS = 12

// Three-plus short-tenure roles reads as a real pattern to a hiring
// manager; a single short stint is normal and shouldn't flag anything.
export const JOB_HOPPING_SHORT_TENURE_THRESHOLD = 3

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
  engagementType: EngagementType
}

export interface EducationDateRange {
  startDate: Date | null
  graduationDate: Date | null
}

export interface EmploymentGap {
  afterCompany: string
  afterRole: string
  gapMonths: number
  precedingDepartureReason: string | null
  // 'education' when the gap window overlaps a degree's date range (e.g. a
  // full-time MBA between two jobs) — an explained gap should read as
  // context, not an unexplained red flag.
  explainedBy: 'education' | null
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

const INTERNSHIP_TITLE_KEYWORDS = ['intern', 'internship', 'co-op', 'coop']

function isInternshipRole(entry: WorkHistoryEntryInput): boolean {
  if (entry.engagementType === 'INTERNSHIP') return true
  const lower = entry.roleTitle.toLowerCase()
  return INTERNSHIP_TITLE_KEYWORDS.some((kw) => lower.includes(kw))
}

// A rough education window: falls back to ~4 years before graduation when
// no start date is given (resumes routinely omit it), and treats a degree
// with no graduation date as still ongoing as of `asOf`.
function educationWindow(edu: EducationDateRange, asOf: Date): { start: Date; end: Date } | null {
  if (!edu.startDate && !edu.graduationDate) return null
  const end = edu.graduationDate ?? asOf
  const start = edu.startDate ?? new Date(end.getFullYear() - 4, end.getMonth(), 1)
  return { start, end }
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

function overlapsAnyEducationWindow(
  entryStart: Date,
  entryEnd: Date,
  education: EducationDateRange[],
  asOf: Date
): boolean {
  return education.some((edu) => {
    const window = educationWindow(edu, asOf)
    return window ? rangesOverlap(entryStart, entryEnd, window.start, window.end) : false
  })
}

// `education` cross-references two things: a short stint that's really a
// school-adjacent internship gets excluded from tenure/gap counting
// entirely, and a real employment gap that overlaps a degree's dates gets
// tagged as explained rather than left looking unexplained.
export function computeWorkHistoryFacts(
  workHistory: WorkHistoryEntryInput[],
  education: EducationDateRange[] = [],
  asOf: Date = new Date()
): WorkHistoryAnalysis {
  const countable = workHistory.filter((entry) => {
    if (isInternshipRole(entry)) return false
    const entryEnd = entry.isCurrent ? asOf : (entry.endDate ?? asOf)
    return !overlapsAnyEducationWindow(entry.startDate, entryEnd, education, asOf)
  })

  const sorted = [...countable].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const gaps: EmploymentGap[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]
    const currentEnd = current.isCurrent ? asOf : (current.endDate ?? asOf)
    const gapMonths = monthsBetween(currentEnd, next.startDate)
    if (gapMonths >= GAP_THRESHOLD_MONTHS) {
      const explainedBy = overlapsAnyEducationWindow(currentEnd, next.startDate, education, asOf)
        ? 'education'
        : null
      gaps.push({
        afterCompany: current.companyName,
        afterRole: current.roleTitle,
        gapMonths,
        precedingDepartureReason: current.departureReason,
        explainedBy,
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

// Sorts roles chronologically and diffs consecutive inferred seniority
// levels (reusing the same ordinal HIGHEST_LEVEL_OPTIONS.indexOf() pattern
// as compute-match-score.ts's levelDistance). Any clear decrease anywhere
// reads as a demotion signal even if later roles recover; otherwise any
// clear increase reads as a promotion. Returns null (never a guessed
// default) when there are fewer than two real roles to compare — mirrors
// the "don't fabricate a pattern" convention used elsewhere in this app.
export function detectCareerTrajectory(workHistory: WorkHistoryEntryInput[]): CareerTrajectory | null {
  const real = workHistory.filter((entry) => !isInternshipRole(entry))
  if (real.length < 2) return null

  const sorted = [...real].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const levels = HIGHEST_LEVEL_OPTIONS as readonly string[]
  const indices = sorted.map((entry) => levels.indexOf(inferLevelFromTitle(entry.roleTitle)))

  let hasIncrease = false
  let hasDecrease = false
  for (let i = 1; i < indices.length; i++) {
    const diff = indices[i] - indices[i - 1]
    if (diff > 0) hasIncrease = true
    if (diff < 0) hasDecrease = true
  }

  if (hasDecrease) return 'DEMOTED'
  if (hasIncrease) return 'PROMOTED'
  return 'STABLE'
}
