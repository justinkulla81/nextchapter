import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
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
// nightly run (the two older dates are counted in SQL), not one query per company.

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
  createdAt: Date
}

// "Open roles as of date X" — createdAt is stable (never overwritten on
// re-import) and archivedAt is timestamped on closure, so this is directly
// computable with no snapshot table, per the real ExclusiveJobPosting
// semantics documented on that model. Grouped by normalizeOrgName(companyName)
// since there's no DB-level normalized column to filter on (see header note).
// The database's default statement timeout (about 2 minutes) cancelled these full-board reads on a slow moment
// ("canceling statement due to statement timeout", code 57014), failing the whole nightly job. The cron has up to 800
// seconds, so each read gets a longer limit of its own, set for that one transaction only.
const READ_TIMEOUT_MS = 280_000
function withLongTimeout<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${READ_TIMEOUT_MS / 1000 - 10}s'`)
      return run(tx)
    },
    { timeout: READ_TIMEOUT_MS, maxWait: 60_000 },
  )
}

// Every open posting, WITHOUT its description: the board is ~560,000 live rows and the descriptions are ~1.6 GB of
// compressed text, so reading all of them is what pushed this job to 430-760 seconds and into statement timeouts and
// the "convert rust String into napi string" failure. The columns read here are cheap, so one query is enough.
// "Open as of the run" is simply archivedAt IS NULL: asOf is the moment the run starts, so no archive date can be after it.
async function openPostingsGrouped(): Promise<Map<string, PostingRow[]>> {
  const rows = await withLongTimeout((tx) => tx.$queryRaw<PostingRow[]>`
    SELECT "companyName", "title", "level", "createdAt"
    FROM public."ExclusiveJobPosting"
    WHERE "institutionScopeId" IS NULL AND "archivedAt" IS NULL`)
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

// Skills are counted from the title and the first 1,000 characters of the description, for the newest SKILL_SAMPLE
// postings of each employer name (2,429 of ~65,000 names have more than 40 open roles and hold 59% of the rows).
// Employers with SKILL_SAMPLE roles or fewer are read in full; for bigger ones buildCompanySignals scales the counts
// up to the real number of open roles. Read in buckets of employer names so no single result is huge.
const SKILL_SAMPLE = 30
const SAMPLE_BUCKETS = 4
async function sampleTextsGrouped(): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>()
  for (let bucket = 0; bucket < SAMPLE_BUCKETS; bucket++) {
    const rows = await withLongTimeout((tx) => tx.$queryRaw<{ companyName: string; title: string; description: string | null }[]>`
      SELECT "companyName", "title", left("description", 1000) AS "description"
      FROM (
        SELECT "companyName", "title", "description",
               row_number() OVER (PARTITION BY "companyName" ORDER BY "createdAt" DESC, "id") AS rn
        FROM public."ExclusiveJobPosting"
        WHERE "institutionScopeId" IS NULL AND "archivedAt" IS NULL
          AND (hashtext("companyName") & ${SAMPLE_BUCKETS - 1}::int) = ${bucket}::int
      ) t
      WHERE rn <= ${SKILL_SAMPLE}::int`)
    for (const row of rows) {
      const key = normalizeOrgName(row.companyName)
      if (!key) continue
      const text = `${row.title} ${row.description ?? ''}`
      const list = grouped.get(key)
      if (list) list.push(text)
      else grouped.set(key, [text])
    }
  }
  return grouped
}

// The 4- and 12-week comparisons only need how many roles an employer had then, not the postings themselves, so both
// are counted in one SQL pass (one row per employer name) instead of two full-table scans.
async function pastOpenCounts(fourWeeksAgo: Date, twelveWeeksAgo: Date): Promise<{ past4: Map<string, number>; past12: Map<string, number> }> {
  const rows = await withLongTimeout((tx) => tx.$queryRaw<{ companyName: string; n4: number; n12: number }[]>`
    SELECT "companyName",
           count(*) FILTER (WHERE "createdAt" <= ${fourWeeksAgo} AND ("archivedAt" IS NULL OR "archivedAt" > ${fourWeeksAgo}))::int AS n4,
           count(*) FILTER (WHERE "createdAt" <= ${twelveWeeksAgo} AND ("archivedAt" IS NULL OR "archivedAt" > ${twelveWeeksAgo}))::int AS n12
    FROM public."ExclusiveJobPosting"
    WHERE "institutionScopeId" IS NULL AND "createdAt" <= ${fourWeeksAgo}
    GROUP BY "companyName"`)
  const past4 = new Map<string, number>()
  const past12 = new Map<string, number>()
  for (const row of rows) {
    const key = normalizeOrgName(row.companyName)
    if (!key) continue
    past4.set(key, (past4.get(key) ?? 0) + row.n4)
    past12.set(key, (past12.get(key) ?? 0) + row.n12)
  }
  return { past4, past12 }
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

// Crawler-discovery guard. computeTrajectory reads "no roles 12 weeks ago, 2+
// now" as growing — right for a company that really started hiring, wrong for
// one our crawler simply found later (a bulk import can add tens of thousands
// of postings, from thousands of employers we hadn't crawled, in one week).
// Those employers have no earlier count because we weren't looking, not
// because they weren't hiring, so they get no verdict.
//
// A bulk-import week is one whose number of new postings dwarfs the usual
// weekly flow. Deliberately relative (5x the median week, and at least 500),
// not a hard-coded date, so it keeps working for the next import.
const WEEK_MS = 7 * DAY_MS
const BULK_IMPORT_MULTIPLE = 5
const BULK_IMPORT_MIN_POSTINGS = 500

const weekBucket = (t: number) => Math.floor((t + 3 * DAY_MS) / WEEK_MS)

export function bulkImportWeeks(createdAts: Date[]): Set<number> {
  const perWeek = new Map<number, number>()
  for (const d of createdAts) {
    const b = weekBucket(d.getTime())
    perWeek.set(b, (perWeek.get(b) ?? 0) + 1)
  }
  const counts = [...perWeek.values()].sort((a, b) => a - b)
  if (counts.length === 0) return new Set()
  const median = counts[Math.floor(counts.length / 2)]
  const threshold = Math.max(BULK_IMPORT_MIN_POSTINGS, median * BULK_IMPORT_MULTIPLE)
  return new Set([...perWeek.entries()].filter(([, n]) => n > threshold).map(([b]) => b))
}

export function wasDiscoveredInBulkImport(earliestPosting: Date, importWeeks: Set<number>): boolean {
  return importWeeks.has(weekBucket(earliestPosting.getTime()))
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

export interface SignalInputs {
  current: Map<string, PostingRow[]>
  /** Title + description text of up to SKILL_SAMPLE of each employer's newest open postings. */
  sampleTexts: Map<string, string[]>
  past4wk: Map<string, number>
  past12wk: Map<string, number>
}

/** Skill counts from a sample, scaled up to all the employer's open roles when the sample is smaller than that. */
export function scaleSkillCounts(ranked: { term: string; count: number }[], sampled: number, total: number): { term: string; count: number }[] {
  if (sampled <= 0 || sampled >= total) return ranked
  const scale = total / sampled
  return ranked.map((r) => ({ term: r.term, count: Math.max(1, Math.round(r.count * scale)) }))
}

// The pure part: one ComputedCompanySignal per company with at least one currently-open posting.
export function buildCompanySignals({ current: currentGrouped, sampleTexts, past4wk: fourWeeksAgoCounts, past12wk: twelveWeeksAgoCounts }: SignalInputs, asOf: Date): ComputedCompanySignal[] {
  const results: ComputedCompanySignal[] = []
  const importWeeks = bulkImportWeeks([...currentGrouped.values()].flatMap((rows) => rows.map((p) => p.createdAt)))

  for (const [companyNameNormalized, current] of currentGrouped) {
    const openRolesTotal = current.length
    const openRolesDirectorPlus = current.filter((p) => isDirectorPlus(p.level)).length
    const past4wk = fourWeeksAgoCounts.get(companyNameNormalized) ?? 0
    const past12wk = twelveWeeksAgoCounts.get(companyNameNormalized) ?? 0
    const rolesDelta4wk = openRolesTotal - past4wk
    const rolesDelta12wk = openRolesTotal - past12wk
    // No roles 12 weeks ago: only call it growing if we were plausibly already
    // watching this employer (its first posting is not from a bulk import).
    let earliestMs = Infinity
    for (const p of current) if (p.createdAt.getTime() < earliestMs) earliestMs = p.createdAt.getTime()
    const earliest = new Date(earliestMs)
    const trajectory =
      past12wk === 0 && wasDiscoveredInBulkImport(earliest, importWeeks)
        ? 'flat'
        : computeTrajectory(openRolesTotal, past12wk)

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

    const texts = sampleTexts.get(companyNameNormalized) ?? []
    const topSkillsRequested = scaleSkillCounts(extractTopSkills(texts, 10), texts.length, openRolesTotal)

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

// The nightly job's full output. The reads run one after another, not at once: three heavy scans in parallel were
// competing for the same database and each other.
export async function computeAllCompanySignals(asOf: Date = new Date()): Promise<ComputedCompanySignal[]> {
  const fourWeeksAgo = new Date(asOf.getTime() - 28 * DAY_MS)
  const twelveWeeksAgo = new Date(asOf.getTime() - 84 * DAY_MS)

  const current = await openPostingsGrouped()
  const { past4, past12 } = await pastOpenCounts(fourWeeksAgo, twelveWeeksAgo)
  const sampleTexts = await sampleTextsGrouped()
  return buildCompanySignals({ current, sampleTexts, past4wk: past4, past12wk: past12 }, asOf)
}
