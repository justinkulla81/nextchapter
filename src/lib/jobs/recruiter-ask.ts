import { levelForPosting } from '@/lib/jobs/job-seniority'

// Who gets the "want recruiters for this space?" ask on a public job page (owner, 2026-11-03):
// director and above at a big company, VP and above at a small one. Ranks are the job-seniority ladder:
// DIRECTOR 65 to 68, HEAD 72, PARTNER 78, VP 80, EVP/SVP 90, C-suite 100.
export const DIRECTOR_RANK = 65
export const VP_RANK = 72 // "Head of ..." counts as VP level; a plain director does not

/** Big = 1,001 employees or more (Company.sizeBand MID_LARGE and up). An unknown size counts as small, the stricter bar. */
const BIG_BANDS = new Set(['MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA'])
export const isBigCompany = (sizeBand: string | null | undefined): boolean => !!sizeBand && BIG_BANDS.has(sizeBand)

// ncrawl's own level on the row (ExclusiveJobPosting.level) can be firmer than the title alone.
const NCRAWL_RANK: Record<string, number> = { C_SUITE: 100, BOARD: 100, EVP_SVP: 90, VP: 80, PARTNER: 78, HEAD: 72, DIRECTOR: 65 }

export function showRecruiterAsk(job: { title: string; description: string | null; companyName: string; level?: string | null }, sizeBand: string | null | undefined): boolean {
  const fromTitle = levelForPosting(job.title, job.description, { companyName: job.companyName }).rank
  const rank = Math.max(fromTitle, NCRAWL_RANK[job.level ?? ''] ?? 0)
  return rank >= (isBigCompany(sizeBand) ? DIRECTOR_RANK : VP_RANK)
}
