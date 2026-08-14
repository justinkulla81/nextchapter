import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { extractTopSkills } from '@/lib/companies/skills-extraction'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// company_signals (Phase 2 Master Script, Part C, Prompt 2) — computed
// purely from ExclusiveJobPosting. No WARN input anywhere in this module —
// see the schema comment on CompanySignal for why, and
// src/app/api/cron/company-signals/route.ts for the cron that calls this.
//
// ExclusiveJobPosting has no companyNameNormalized column (unlike
// WorkHistoryEntry/CompanyWatchlistEntry) — companyName is plain free text.
// Rather than adding one (a schema change this pass deliberately keeps
// additive-and-minimal), every "open roles as of date X" query below fetches
// the whole date-windowed row set once and groups it in memory by
// normalizeOrgName(companyName) — three bulk queries total for the entire
// nightly run, not one query per company.

const DAY_MS = 24 * 60 * 60 * 1000

// ncrawl's real seniority taxonomy for ExclusiveJobPosting.level (free
// text, per that field's own schema comment: "e.g. C_SUITE, EVP_SVP, VP,
// DIRECTOR"). Postings with no level at all (most non-ncrawl rows) are
// counted in openRolesTotal but not in openRolesDirectorPlus — level is
// never guessed from title here, since ncrawl's classification is the only
// trustworthy source for this specific subcount.
const DIRECTOR_PLUS_LEVELS = new Set(['DIRECTOR', 'EVP_SVP', 'VP', 'C_SUITE'])

function isDirectorPlus(level: string | null): boolean {
  if (!level) return false
  return DIRECTOR_PLUS_LEVELS.has(level.toUpperCase())
}

interface PostingRow {
  companyName: string
  title: string
  level: string | null
  description: string | null
  createdAt: Date
}

// "Open roles as of date X" — createdAt is stable (never overwritten on
// re-import) and archivedAt is timestamped on closure, so this is directly
// computable with no snapshot table, per the real ExclusiveJobPosting
// semantics documented on that model. Grouped by normalizeOrgName(companyName)
// since there's no DB-level normalized column to filter on (see header note).
async function openPostingsAsOfGrouped(asOf: Date): Promise<Map<string, PostingRow[]>> {
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: {
      createdAt: { lte: asOf },
      OR: [{ archivedAt: null }, { archivedAt: { gt: asOf } }],
    },
    select: { companyName: true, title: true, level: true, description: true, createdAt: true },
  })

  const grouped = new Map<string, PostingRow[]>()
  for (const row of rows) {
    const key = normalizeOrgName(row.companyName)
    if (!key) continue
    const list = grouped.get(key)
    if (list) list.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

// rolesDelta12wk relative-change thresholds — a company needs BOTH a 15%
// relative move AND at least 2 real roles of absolute change to count as
// growing/contracting; a 1-role swing at a small company (e.g. 2 -> 3
// postings) is real but too noisy to label a "trajectory" on. Documented
// here since these are a NextChapter judgment call, not a spec-given
// number — revisit once there's real posting volume to calibrate against.
const RELATIVE_THRESHOLD = 0.15
const MIN_ABSOLUTE_DELTA = 2

export type Trajectory = 'growing' | 'flat' | 'contracting'

export function computeTrajectory(current: number, past12wk: number): Trajectory {
  const delta = current - past12wk
  if (past12wk === 0) {
    return current >= MIN_ABSOLUTE_DELTA ? 'growing' : 'flat'
  }
  const relativeChange = delta / past12wk
  if (relativeChange >= RELATIVE_THRESHOLD && delta >= MIN_ABSOLUTE_DELTA) return 'growing'
  if (relativeChange <= -RELATIVE_THRESHOLD && delta <= -MIN_ABSOLUTE_DELTA) return 'contracting'
  return 'flat'
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

export interface ComputedCompanySignal {
  companyName: string // first-seen raw casing among the current open postings, for Company.name
  companyNameNormalized: string
  openRolesTotal: number
  openRolesDirectorPlus: number
  rolesDelta4wk: number
  rolesDelta12wk: number
  trajectory: Trajectory
  topFunctionsHiring: { function: string; count: number }[]
  topSkillsRequested: { term: string; count: number }[]
  medianPostingAgeDays: number | null
}

// Computes one ComputedCompanySignal per company with at least one
// currently-open posting — the cron's full nightly output, in three bulk
// queries regardless of how many companies exist.
export async function computeAllCompanySignals(asOf: Date = new Date()): Promise<ComputedCompanySignal[]> {
  const fourWeeksAgo = new Date(asOf.getTime() - 28 * DAY_MS)
  const twelveWeeksAgo = new Date(asOf.getTime() - 84 * DAY_MS)

  const [currentGrouped, fourWeeksAgoGrouped, twelveWeeksAgoGrouped] = await Promise.all([
    openPostingsAsOfGrouped(asOf),
    openPostingsAsOfGrouped(fourWeeksAgo),
    openPostingsAsOfGrouped(twelveWeeksAgo),
  ])

  const results: ComputedCompanySignal[] = []

  for (const [companyNameNormalized, current] of currentGrouped) {
    const openRolesTotal = current.length
    const openRolesDirectorPlus = current.filter((p) => isDirectorPlus(p.level)).length
    const past4wk = fourWeeksAgoGrouped.get(companyNameNormalized)?.length ?? 0
    const past12wk = twelveWeeksAgoGrouped.get(companyNameNormalized)?.length ?? 0
    const rolesDelta4wk = openRolesTotal - past4wk
    const rolesDelta12wk = openRolesTotal - past12wk
    const trajectory = computeTrajectory(openRolesTotal, past12wk)

    const functionCounts = new Map<string, number>()
    for (const p of current) {
      const fn = inferFunctionFromTitle(p.title)
      if (!fn) continue
      functionCounts.set(fn, (functionCounts.get(fn) ?? 0) + 1)
    }
    const topFunctionsHiring = Array.from(functionCounts.entries())
      .map(([func, count]) => ({ function: func, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topSkillsRequested = extractTopSkills(
      current.map((p) => `${p.title} ${p.description ?? ''}`),
      10
    )

    const postingAges = current.map((p) => Math.floor((asOf.getTime() - p.createdAt.getTime()) / DAY_MS))
    const medianPostingAgeDays = medianOf(postingAges)

    results.push({
      companyName: current[0].companyName,
      companyNameNormalized,
      openRolesTotal,
      openRolesDirectorPlus,
      rolesDelta4wk,
      rolesDelta12wk,
      trajectory,
      topFunctionsHiring,
      topSkillsRequested,
      medianPostingAgeDays,
    })
  }

  return results
}
