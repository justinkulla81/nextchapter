import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// company_application_outcomes (Phase 2 Master Script, Part C, Prompt 2) —
// "How members have fared," aggregate only. Computed from real JobPosting
// rows (the candidate's own tracked-application record — appliedAt/
// declinedAt/interviewLandedAt/offerReceivedAt), never from any admin/
// employer-facing table.
//
// Each nightly run writes a fresh, all-time-cumulative row per company for
// "this week" (upserted against CompanyApplicationOutcome's
// [companyId, weekStartDate] unique constraint) — same "rerunning a week
// overwrites cleanly" convention PopulationSnapshot already established,
// and the same reason: the candidate-facing company page always reads the
// MOST RECENT row per company, never sums across weeks, so there's no
// double-counting risk from a cumulative-not-incremental design.
//
// Scoped to companies that already have a Company row (i.e. appear in
// ExclusiveJobPosting) — JobPosting.companyName is free text a candidate
// typed or an email parser guessed, much noisier than the job-board feed,
// so this deliberately doesn't create new Company rows from it. A company
// with real candidate applications but no job-board presence won't get an
// outcomes row this phase; documented limitation, not a silent gap.

interface JobPostingOutcomeRow {
  companyName: string
  appliedAt: Date | null
  declinedAt: Date | null
  interviewLandedAt: Date | null
  offerReceivedAt: Date | null
}

export interface ComputedApplicationOutcome {
  companyNameNormalized: string
  applications: number
  responses: number
  interviews: number
  offers: number
  avgDaysToInterview: number | null
  avgDaysToRejection: number | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
}

export async function computeAllApplicationOutcomes(): Promise<ComputedApplicationOutcome[]> {
  const rows = await prisma.jobPosting.findMany({
    where: { appliedAt: { not: null }, companyName: { not: null } },
    select: { companyName: true, appliedAt: true, declinedAt: true, interviewLandedAt: true, offerReceivedAt: true },
  })

  const grouped = new Map<string, JobPostingOutcomeRow[]>()
  for (const row of rows) {
    if (!row.companyName) continue
    const key = normalizeOrgName(row.companyName)
    if (!key) continue
    const list = grouped.get(key)
    if (list) list.push(row as JobPostingOutcomeRow)
    else grouped.set(key, [row as JobPostingOutcomeRow])
  }

  const results: ComputedApplicationOutcome[] = []
  for (const [companyNameNormalized, postings] of grouped) {
    const applications = postings.length
    const responses = postings.filter((p) => p.declinedAt || p.interviewLandedAt || p.offerReceivedAt).length
    const interviews = postings.filter((p) => p.interviewLandedAt).length
    const offers = postings.filter((p) => p.offerReceivedAt).length

    const daysToInterview = postings
      .filter((p) => p.appliedAt && p.interviewLandedAt)
      .map((p) => (p.interviewLandedAt!.getTime() - p.appliedAt!.getTime()) / MS_PER_DAY)
    const daysToRejection = postings
      .filter((p) => p.appliedAt && p.declinedAt)
      .map((p) => (p.declinedAt!.getTime() - p.appliedAt!.getTime()) / MS_PER_DAY)

    results.push({
      companyNameNormalized,
      applications,
      responses,
      interviews,
      offers,
      avgDaysToInterview: average(daysToInterview),
      avgDaysToRejection: average(daysToRejection),
    })
  }
  return results
}
