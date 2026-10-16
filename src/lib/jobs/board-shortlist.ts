import 'server-only'
import type { ExclusiveJobPosting, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { boardListingFitBucketScorerFor, type FitScoringVersion } from '@/lib/jobs/email-fit-scoring'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { COMPETITION_SORT_RANK, isFresh, scoreCompetition } from '@/lib/jobs/competition'
import { classifyLocation } from '@/lib/jobs/us-location'
import { ghostRisk, repostKey } from '@/lib/jobs/ghost-risk'
import { getClosedPostingCounts } from '@/lib/jobs/ghost-risk-data'
import { calibratedLevelDistance, calibratedLevelRank } from '@/lib/scoring/level-rank'
import { ALL_STAGES_WINDOW, EARLY_CAREER_RUNGS, MID_LEVEL_RUNGS, memberStageWindow, stageWindowWhere, type StageWindow } from '@/lib/jobs/career-stage'
import { isInternshipJob, memberWorkType, type WorkType } from '@/lib/jobs/work-type'
import { notInternshipWhere } from '@/lib/internships/exclude'
import { findLightRows, LIGHT_SELECT, type LightRow } from '@/lib/jobs/board-light-rows'
import { annualPayForSort, type BoardSort } from '@/lib/jobs/board-search'
import { sectorKeep } from '@/lib/jobs/employer-sector'

type FitCandidate = Parameters<typeof computeBoardListingFitBucket>[0]

/** Jobs a candidate's board can show: approved, live, not excluded, unexpired. */
export function liveBoardWhere(extra: Prisma.ExclusiveJobPostingWhereInput = {}): Prisma.ExclusiveJobPostingWhereInput {
  return {
    status: 'approved',
    archivedAt: null,
    institutionScopeId: null,
    distribution: { not: 'EXCLUDED' },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    // AND, not a spread: an extra OR must not replace the expiry OR above.
    // Internships are never on a member surface (they live in the Higher Ed
    // portals): rows the crawler typed as internships stay out here, and
    // intern titles are dropped in keepRelevant.
    AND: [notInternshipWhere(), extra],
  }
}

const PER_COMPANY = 5

// Every board render ranks the whole live board, and that fetch was the single
// most expensive thing the site did. Two caches, per server instance, a minute each:
//
// - The whole board (light columns, US and not ghost risk), read from the narrow
//   BoardLightRow copy (board-light-rows.ts), sorted by id. Every view that only
//   narrows it by level and/or a date window — the board page, the coach view,
//   skill gaps, the dashboard's fresh-jobs prompt, and the email paths (fresh-job
//   alerts, Job Search Daily, coach digest; splitBoardWhere) — is cut from this one
//   copy in memory instead of each loading its own. After the minute, the next
//   caller still gets the held copy at once while a fresh one loads (up to
//   SHARED_STALE_MS old); only a cold server instance waits.
// - Any other filter: its own rows from the wide table, keyed by the filter.
//
// Rows are read-only downstream; per-row work is memoised on them (rowFacts).
const LIGHT_TTL_MS = 60_000
const SHARED_STALE_MS = 5 * 60_000
const LIGHT_MAX_KEYS = 20
const lightCache = new Map<string, { at: number; rows: Promise<LightRow[]> }>()

/** Not confidently outside the US, and not a listing that looks evergreen or fake (ghost-risk.ts). */
function keepRelevant(all: LightRow[], closedCounts: Map<string, number>): LightRow[] {
  const nowMs = Date.now()
  // Only relevant jobs reach a member. Excluded rows are kept in the database —
  // this filters the view, it deletes nothing — and the board totals are
  // computed over what is kept, so they match what is shown.
  // Locations repeat (~30k distinct over 150k jobs).
  const nonUs = new Map<string | null, boolean>()
  return all.filter((p) => {
    // Internships only appear in Higher Ed portals, never on a member's board,
    // emails, alerts or counts — all of which are cut from these rows.
    if (isInternshipJob(p)) return false
    let outside = nonUs.get(p.location)
    if (outside === undefined) {
      outside = classifyLocation(p.location) === 'non_us'
      nonUs.set(p.location, outside)
    }
    if (outside) return false
    const ghost = ghostRisk({
      priorClosedCount: closedCounts.get(repostKey(p.companyName, p.title, p.location)) ?? 0,
      ageDays: (nowMs - p.createdAt.getTime()) / 86_400_000,
    })
    return ghost.level !== 'likely'
  })
}

// Postgres returns rows in storage order, which every import reshuffles; ranking
// ties (same fit, level, age…) then fell out differently from one load to the
// next. Sorted by id, the same board always ranks the same way.
const byId = (a: LightRow, b: LightRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// The previous load's rows by id (per shared board). A reload hands back the
// previous object for any row that hasn't changed, so the per-row work memoised
// on it (rowFacts, the fit scorer's posting side — ~2-3 s for the whole board)
// is only redone for rows that did change.
const LIGHT_KEYS = Object.keys(LIGHT_SELECT) as (keyof LightRow)[]
function sameRow(a: LightRow, b: LightRow): boolean {
  for (const k of LIGHT_KEYS) {
    const x = a[k]
    const y = b[k]
    if (x instanceof Date && y instanceof Date ? x.getTime() !== y.getTime() : x !== y) return false
  }
  return true
}
// Columns whose values repeat across many rows: one string per distinct value
// instead of one per row (the shared board is ~160k rows).
const REPEATED_COLUMNS = [
  'companyName', 'audienceTier', 'source', 'targetFunction', 'targetLevel', 'targetRemotePolicy',
  'targetLocation', 'location', 'level', 'sourceCategory', 'employmentType', 'employerSector', 'requirementTags',
] as const satisfies readonly (keyof LightRow)[]
function internRepeated(rows: LightRow[]): void {
  const pool = new Map<string, string>()
  for (const r of rows) {
    const row = r as Record<(typeof REPEATED_COLUMNS)[number], string | null>
    for (const k of REPEATED_COLUMNS) {
      const v = row[k]
      if (v === null) continue
      const hit = pool.get(v)
      if (hit === undefined) pool.set(v, v)
      else row[k] = hit
    }
  }
}

function reuseUnchanged(rows: LightRow[], previous: Map<string, LightRow>): { rows: LightRow[]; byId: Map<string, LightRow> } {
  internRepeated(rows)
  const kept = new Map<string, LightRow>()
  const out = rows.map((r) => {
    const before = previous.get(r.id)
    const keep = before && sameRow(before, r) ? before : r
    kept.set(keep.id, keep)
    return keep
  })
  return { rows: out, byId: kept }
}

// Two shared boards: the core one (everything but the early-career rungs) that
// every view reads, and the early-career one (ENTRY_IC, EARLY_IC), loaded only
// when a view's level window includes those rungs — so members who never see
// early-career jobs, and every email path, don't pay to load them.
function sharedBoard(extra: Prisma.ExclusiveJobPostingWhereInput, name: string): (closedCounts: Map<string, number>) => Promise<LightRow[]> {
  let shared: { at: number; rows: Promise<LightRow[]> } | null = null
  let loading: Promise<LightRow[]> | null = null
  let previousById = new Map<string, LightRow>()
  return (closedCounts) => {
    const now = Date.now()
    if (shared && now - shared.at < LIGHT_TTL_MS) return shared.rows
    if (!loading) {
      const started = now
      const next = (async () => {
        const out = reuseUnchanged(keepRelevant(await findLightRows(liveBoardWhere(extra)), closedCounts).sort(byId), previousById)
        previousById = out.byId
        return out.rows
      })()
      loading = next
      next.then(
        () => {
          shared = { at: started, rows: next }
          loading = null
        },
        (error) => {
          console.error(`Board light rows (${name}): load failed`, error)
          loading = null
        }
      )
    }
    // Past the minute: the held copy, while the new one loads.
    if (shared && now - shared.at < SHARED_STALE_MS) return shared.rows
    return loading
  }
}

const loadCoreBoard = sharedBoard({ OR: [{ level: null }, { level: { notIn: EARLY_CAREER_RUNGS } }] }, 'core')
const loadEarlyCareerBoard = sharedBoard({ level: { in: EARLY_CAREER_RUNGS } }, 'early career')

// Both boards in one id-sorted array, kept while neither changes (so subsets cut
// from it are reused too).
let merged: { core: LightRow[]; early: LightRow[]; rows: LightRow[] } | null = null
function mergeById(core: LightRow[], early: LightRow[]): LightRow[] {
  if (merged && merged.core === core && merged.early === early) return merged.rows
  const rows: LightRow[] = new Array(core.length + early.length)
  let i = 0
  let j = 0
  let k = 0
  while (i < core.length && j < early.length) rows[k++] = byId(core[i], early[j]) <= 0 ? core[i++] : early[j++]
  while (i < core.length) rows[k++] = core[i++]
  while (j < early.length) rows[k++] = early[j++]
  merged = { core, early, rows }
  return rows
}

async function loadSharedBoard(closedCounts: Map<string, number>, withEarlyCareer: boolean): Promise<LightRow[]> {
  if (!withEarlyCareer) return loadCoreBoard(closedCounts)
  const [core, early] = await Promise.all([loadCoreBoard(closedCounts), loadEarlyCareerBoard(closedCounts)])
  return mergeById(core, early)
}

// Subsets of the shared board, by filter key, so a view's array (and everything
// memoised on it — company counts) is reused across requests until the board reloads.
const subsets = new Map<string, LightRow[]>()

function subsetOf(all: LightRow[], key: string, keep: (p: LightRow) => boolean): LightRow[] {
  let hit = subsets.get(key)
  if (!hit || subsetSource.get(hit) !== all) {
    hit = all.filter(keep)
    subsetSource.set(hit, all)
    if (subsets.size >= LIGHT_MAX_KEYS) subsets.delete(subsets.keys().next().value as string)
    subsets.set(key, hit)
  }
  return hit
}
const subsetSource = new WeakMap<LightRow[], LightRow[]>()

/**
 * A where the shared board can answer in memory: nothing, a level window, a
 * level list, or an AND of those — as the JS equivalent of the SQL Prisma
 * writes for it. null for anything else.
 */
export function levelOnlyFilter(where: Prisma.ExclusiveJobPostingWhereInput | undefined): ((p: { level: string | null }) => boolean) | null {
  if (where === undefined || where === null) return () => true
  if (typeof where !== 'object' || Array.isArray(where)) return null
  const keys = Object.keys(where)
  if (keys.length === 0) return () => true
  if (keys.length !== 1) return null
  if (keys[0] === 'AND') {
    const parts = Array.isArray(where.AND) ? where.AND : [where.AND]
    const filters = parts.map((w) => levelOnlyFilter(w as Prisma.ExclusiveJobPostingWhereInput))
    if (filters.some((f) => f === null)) return null
    return (p) => filters.every((f) => f!(p))
  }
  // { level: { in: [...] } } — SQL IN: a job with no level never matches.
  if (keys[0] === 'level') {
    const level = where.level
    if (level && typeof level === 'object' && !Array.isArray(level) && Object.keys(level).length === 1 && Array.isArray((level as { in?: unknown }).in)) {
      const allowed = new Set((level as { in: string[] }).in)
      return (p) => p.level !== null && allowed.has(p.level)
    }
    return null
  }
  // An OR of level conditions — a stage window (career-stage.ts stageWindowWhere:
  // no level, or a level in the window) or EXCLUDE_MID_LEVEL_WHERE.
  if (keys[0] === 'OR') {
    const parts = (Array.isArray(where.OR) ? where.OR : [where.OR]) as Prisma.ExclusiveJobPostingWhereInput[]
    const filters = parts.map(levelCondition)
    if (filters.length === 0 || filters.some((f) => f === null)) return null
    return (p) => filters.some((f) => f!(p))
  }
  return null
}

// One OR branch: { level: null }, { level: { not: X } } (SQL: a job with no level
// never matches), or anything levelOnlyFilter answers.
function levelCondition(where: Prisma.ExclusiveJobPostingWhereInput): ((p: { level: string | null }) => boolean) | null {
  if (where && typeof where === 'object' && Object.keys(where).length === 1 && 'level' in where) {
    const level = where.level
    if (level === null) return (p) => p.level === null
    if (level && typeof level === 'object' && Object.keys(level).length === 1 && typeof (level as { not?: unknown }).not === 'string') {
      const not = (level as { not: string }).not
      return (p) => p.level !== null && p.level !== not
    }
  }
  return levelOnlyFilter(where)
}

/** postedWithinWhere(hours) in memory: posted in the window, or (no posting date) imported in it. */
export function postedWithinFilter(hours: number, now = Date.now()): (p: { postedAt: Date | null; createdAt: Date }) => boolean {
  const since = now - hours * 3_600_000
  return (p) => (p.postedAt !== null ? p.postedAt.getTime() >= since : p.createdAt.getTime() >= since)
}

type DateRow = { postedAt: Date | null; createdAt: Date }

const isDate = (v: unknown): v is Date => v instanceof Date && !Number.isNaN(v.getTime())
const onlyKeys = (o: unknown, keys: string[]): o is Record<string, unknown> =>
  !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => k in (o as object))
const gteDate = (v: unknown): Date | null => (onlyKeys(v, ['gte']) && isDate(v.gte) ? v.gte : null)

/**
 * A date window the email paths pass as a where, as the JS equivalent of the
 * SQL Prisma writes for it; null for anything else:
 * - postedWithinWhere(h): posted since, or (no posting date) imported since;
 * - { createdAt: { gte } }: imported since.
 */
export function dateWindowFilter(where: unknown): ((p: DateRow) => boolean) | null {
  if (onlyKeys(where, ['createdAt'])) {
    const since = gteDate(where.createdAt)
    if (!since) return null
    const t = since.getTime()
    return (p) => p.createdAt.getTime() >= t
  }
  if (onlyKeys(where, ['OR']) && Array.isArray(where.OR) && where.OR.length === 2) {
    const [a, b] = where.OR as unknown[]
    if (!onlyKeys(a, ['postedAt']) || !onlyKeys(b, ['postedAt', 'createdAt']) || b.postedAt !== null) return null
    const since = gteDate(a.postedAt)
    const since2 = gteDate(b.createdAt)
    if (!since || !since2 || since.getTime() !== since2.getTime()) return null
    const t = since.getTime()
    return (p) => (p.postedAt !== null ? p.postedAt.getTime() >= t : p.createdAt.getTime() >= t)
  }
  return null
}

/**
 * Splits a where into a level-only part (answered from a cached subset of the
 * shared board) and date windows (applied per call). null when any part is
 * neither — that where goes to the database.
 */
export function splitBoardWhere(
  where: Prisma.ExclusiveJobPostingWhereInput | undefined
): { levelWhere: Prisma.ExclusiveJobPostingWhereInput | undefined; windows: ((p: DateRow) => boolean)[] } | null {
  const whole = dateWindowFilter(where)
  if (whole) return { levelWhere: undefined, windows: [whole] }
  if (where && onlyKeys(where, ['AND'])) {
    const parts = (Array.isArray(where.AND) ? where.AND : [where.AND]) as Prisma.ExclusiveJobPostingWhereInput[]
    const windows: ((p: DateRow) => boolean)[] = []
    const rest: Prisma.ExclusiveJobPostingWhereInput[] = []
    for (const part of parts) {
      const w = dateWindowFilter(part)
      if (w) windows.push(w)
      else rest.push(part)
    }
    if (windows.length > 0) {
      const levelWhere = rest.length === 0 ? undefined : { AND: rest }
      return levelOnlyFilter(levelWhere) ? { levelWhere, windows } : null
    }
  }
  return levelOnlyFilter(where) ? { levelWhere: where, windows: [] } : null
}

async function loadLightBoardRows(
  where: Prisma.ExclusiveJobPostingWhereInput | undefined,
  closedCounts: Map<string, number>,
  postedWithinHours?: number
): Promise<LightRow[]> {
  const split = splitBoardWhere(where)
  if (split) {
    const keep = levelOnlyFilter(split.levelWhere)!
    const withEarlyCareer = EARLY_CAREER_RUNGS.some((level) => keep({ level }))
    const all = await loadSharedBoard(closedCounts, withEarlyCareer)
    const byLevel = subsetOf(all, JSON.stringify(split.levelWhere ?? null), keep)
    const windows = [...split.windows, ...(postedWithinHours === undefined ? [] : [postedWithinFilter(postedWithinHours)])]
    if (windows.length === 0) return byLevel
    // A window moves every call, so this cut isn't kept.
    return byLevel.filter((p) => windows.every((w) => w(p)))
  }
  // Not expected: postedWithinHours is only passed with a level-only where.
  if (postedWithinHours !== undefined) where = { AND: [where ?? {}, postedWithinWhere(postedWithinHours)] }

  const key = JSON.stringify(where ?? null)
  const hit = lightCache.get(key)
  if (hit && Date.now() - hit.at < LIGHT_TTL_MS) return hit.rows

  const rows = (async () => {
    const all = await prisma.exclusiveJobPosting.findMany({ where: liveBoardWhere(where), select: LIGHT_SELECT })
    return keepRelevant(all, closedCounts)
  })()

  if (lightCache.size >= LIGHT_MAX_KEYS) lightCache.delete(lightCache.keys().next().value as string)
  lightCache.set(key, { at: Date.now(), rows })
  rows.catch(() => {
    if (lightCache.get(key)?.rows === rows) lightCache.delete(key)
  })
  return rows
}

// Light rows are shared from the caches above, so what ranking reads off a row
// that doesn't depend on the member is worked out once per row per cache fill.
interface RowFacts {
  company: string
  titleKey: string
  // The title's function, lowercased ('' when none).
  titleFunction: string
  // The job's level on the calibrated scale (null when unknown).
  levelRank: number | null
  workType?: WorkType
}
const factsByRow = new WeakMap<BoardRankRow, RowFacts>()
function rowFacts(p: BoardRankRow): RowFacts {
  let f = factsByRow.get(p)
  if (!f) {
    f = {
      company: p.companyName ? normalizeOrgName(p.companyName) : '',
      titleKey: p.title.trim().toLowerCase(),
      titleFunction: (inferFunctionFromTitle(p.title) ?? '').toLowerCase(),
      levelRank: calibratedLevelRank(p.targetLevel ?? candidateScaleLevel(p.level) ?? inferLevelFromTitle(p.title), null),
    }
    factsByRow.set(p, f)
  }
  return f
}
function workTypeOf(p: BoardRankRow): WorkType {
  const f = rowFacts(p)
  // keepRelevant already dropped internships; 'contract' only satisfies the type.
  if (!f.workType) f.workType = memberWorkType({ title: p.title, employmentType: p.employmentType }) ?? 'contract'
  return f.workType
}

// Live jobs per company over one light-row array — the same for every member, so
// kept per array (the shared board's subsets live for the cache minute).
const companyCountsByRows = new WeakMap<BoardRankRow[], Map<string, number>>()
function companyCounts(light: BoardRankRow[]): Map<string, number> {
  let counts = companyCountsByRows.get(light)
  if (!counts) {
    counts = new Map()
    for (const p of light) {
      const { company } = rowFacts(p)
      if (company) counts.set(company, (counts.get(company) ?? 0) + 1)
    }
    companyCountsByRows.set(light, counts)
  }
  return counts
}

/** Board views: everything, posted in the last 72 hours, or low competition only. */
export type BoardView = 'all' | 'fresh' | 'low_competition'

/** Jobs posted (or, with no posting date, imported) in the last 72 hours. */
export function postedWithinWhere(hours: number): Prisma.ExclusiveJobPostingWhereInput {
  const since = new Date(Date.now() - hours * 3_600_000)
  return { OR: [{ postedAt: { gte: since } }, { postedAt: null, createdAt: { gte: since } }] }
}

export interface BoardShortlist {
  /** Full rows of the best-fitting jobs the candidate can open, best first. */
  open: ExclusiveJobPosting[]
  /** Full rows of the best-fitting Candidate+-only jobs they can't open yet, best first. */
  locked: ExclusiveJobPosting[]
  openTotal: number
  lockedTotal: number
  /** Good-or-better fits the candidate can open, across the whole board: posted in the last 72 hours / low competition. */
  freshOpenTotal: number
  lowCompetitionOpenTotal: number
  /** Live board jobs per company (normalizeOrgName key), across the whole board. Shared between requests — read only. */
  countByCompany: ReadonlyMap<string, number>
  /** Jobs the candidate can open, per work type (work-type.ts), before the type filter; zeros unless workTypes was passed. */
  countByWorkType: Record<WorkType, number>
}

/**
 * The board holds tens of thousands of jobs, so a candidate's view is a
 * shortlist: every live job is ranked by fit on its light fields (no
 * description — the heavy column), and only the best `size` per side
 * (open / locked) are loaded in full. Callers then score those exactly,
 * with description and company size, which is also what keeps the
 * company-size lookup (an LLM call the first time a company is seen)
 * bounded to the jobs actually shown.
 *
 * fitScoring: which fit scorer ranks the jobs — 'v2' (default, the board)
 * or 'legacy', the pre-v2 logic the emails stay on until the owner flips
 * FIT_SCORING_V2_FOR_EMAILS (see email-fit-scoring.ts).
 */
export async function loadBoardShortlist(opts: {
  candidate: FitCandidate
  isCandidatePlus: boolean
  where?: Prisma.ExclusiveJobPostingWhereInput
  size?: number
  view?: BoardView
  fitScoring?: FitScoringVersion
  /** Include mid-level (MID_IC) jobs. Off by default — every email path relies on that (mid-level.ts). */
  includeMidLevel?: boolean
  /** Include early-career (ENTRY_IC, EARLY_IC) jobs. Off by default — every email path relies on that. */
  includeEarlyCareer?: boolean
  /**
   * The ladder window to show (career-stage.ts). Omitted: the candidate's own
   * stage window (their stage, one up, one down), or every stage with no candidate.
   * An explicit seniority-filter choice passes ALL_STAGES_WINDOW and its own where.
   */
  stageWindow?: StageWindow
  /** One-board work types to keep; omitted keeps every type (emails, reports). */
  workTypes?: WorkType[]
  /**
   * Only jobs posted (or, with no posting date, imported) in the last this-many
   * hours — postedWithinWhere, answered from the shared board in memory. With a
   * level-only where (or none); see loadLightBoardRows.
   */
  postedWithinHours?: number
  /**
   * Only jobs this keeps (the board's "Great pay" / "Great benefits" filters,
   * great-employers.ts). Applied before everything else, so every total —
   * including the per-work-type counts — is over the kept jobs. Omitted keeps all.
   */
  keep?: (p: BoardRankRow) => boolean
  /** Board search (board-search-index.ts): relevance tier per job (0 best), null drops it. Board only — never the emails. */
  relevance?: (p: BoardRankRow) => number | null
  /** Board sort; omitted or 'best' is the fit order (within relevance tiers when searching). */
  sort?: BoardSort
  /** Jobs per company before the rest are held back (default PER_COMPANY); a company: search lifts it. */
  perCompany?: number
  /**
   * Employer sectors to leave out (employer-sector.ts). Omitted: the member's own
   * saved choice (candidate.hiddenEmployerSectors) — so every email path, which
   * passes the member's profile, never includes a sector they turned off.
   */
  hiddenSectors?: readonly string[]
}): Promise<BoardShortlist> {
  const closedCounts = await getClosedPostingCounts()
  // Only relevant jobs reach a member: not confidently outside the US, and not a
  // listing that looks evergreen or fake (see ghost-risk.ts). Excluded rows are kept
  // in the database — this filters the view, it deletes nothing — and the board
  // totals below are computed over what is kept, so they match what is shown.
  // The level window is part of the filter (and so of the light-row cache key).
  const window = opts.stageWindow ?? (opts.candidate ? memberStageWindow(opts.candidate) : ALL_STAGES_WINDOW)
  const levelWhere = boardLevelWindowWhere(opts.where, { window, includeMidLevel: opts.includeMidLevel, includeEarlyCareer: opts.includeEarlyCareer })
  const light = await loadLightBoardRows(levelWhere, closedCounts, opts.postedWithinHours)
  const hidden = opts.hiddenSectors ?? (opts.candidate as { hiddenEmployerSectors?: string[] | null } | null)?.hiddenEmployerSectors ?? []
  const inSector = sectorKeep(hidden)
  const keep = inSector && opts.keep ? (p: BoardRankRow) => inSector(p) && opts.keep!(p) : (inSector ?? opts.keep)
  const ranked = rankBoardRows(light, { ...opts, keep })
  const full = new Map(
    (await prisma.exclusiveJobPosting.findMany({ where: { id: { in: [...ranked.openIds, ...ranked.lockedIds] } } })).map((p) => [p.id, p])
  )
  const inOrder = (ids: string[]) => ids.map((id) => full.get(id)).filter((p): p is ExclusiveJobPosting => !!p)

  return {
    open: inOrder(ranked.openIds),
    locked: inOrder(ranked.lockedIds),
    openTotal: ranked.openTotal,
    lockedTotal: ranked.lockedTotal,
    freshOpenTotal: ranked.freshOpenTotal,
    lowCompetitionOpenTotal: ranked.lowCompetitionOpenTotal,
    countByCompany: ranked.countByCompany,
    countByWorkType: ranked.countByWorkType,
  }
}

/**
 * The board query's level window: the stage window's rungs (jobs with no level
 * always stay in), less mid-level (MID_IC) and early-career (ENTRY_IC, EARLY_IC)
 * jobs unless asked for. Part of the light-row filter and so of its cache key.
 */
export function boardLevelWindowWhere(
  where: Prisma.ExclusiveJobPostingWhereInput | undefined,
  opts: { window?: StageWindow; includeMidLevel?: boolean; includeEarlyCareer?: boolean } = {}
): Prisma.ExclusiveJobPostingWhereInput {
  const exclude = [...(opts.includeMidLevel ? [] : MID_LEVEL_RUNGS), ...(opts.includeEarlyCareer ? [] : EARLY_CAREER_RUNGS)]
  return { AND: [where ?? {}, stageWindowWhere(opts.window ?? ALL_STAGES_WINDOW, exclude)] }
}

export type BoardRankRow = LightRow

/** The ranking step of loadBoardShortlist, pure — no database. Exported for tests and analysis. */
export function rankBoardRows(
  light: BoardRankRow[],
  opts: {
    candidate: FitCandidate
    isCandidatePlus: boolean
    size?: number
    view?: BoardView
    fitScoring?: FitScoringVersion
    now?: Date
    workTypes?: WorkType[]
    keep?: (p: BoardRankRow) => boolean
    relevance?: (p: BoardRankRow) => number | null
    sort?: BoardSort
    perCompany?: number
  }
) {
  const size = opts.size ?? 300
  const fitBucket = boardListingFitBucketScorerFor(opts.fitScoring ?? 'v2', opts.candidate)
  const countByCompany = companyCounts(light)
  // Within a fit level, roles nearest the candidate's own level come first
  // (a Director sees Director roles before Manager ones), then newest…
  const candidateLevel =
    opts.candidate.levelRankScore ?? calibratedLevelRank(opts.candidate.highestLevelReached, null)
  // …and, before level, roles in the candidate's own function.
  const functions = new Set(
    [opts.candidate.primaryFunction, opts.candidate.secondaryFunction].filter(Boolean).map((f) => f!.trim().toLowerCase())
  )
  const open: {
    id: string
    rank: number
    offFunction: number
    crowd: number
    gap: number
    at: number
    company: string
    title: string
    rel: number
    posted: number
    pay: number
  }[] = []
  const locked: typeof open = []
  const now = opts.now ?? new Date()
  let freshOpenTotal = 0
  let lowCompetitionOpenTotal = 0
  const countByWorkType: Record<WorkType, number> = { full_time: 0, part_time: 0, contract: 0, advisory: 0 }
  const typeFilter = opts.workTypes && opts.workTypes.length > 0 ? new Set(opts.workTypes) : null
  for (const p of light) {
    if (opts.keep && !opts.keep(p)) continue
    const rel = opts.relevance ? opts.relevance(p) : 0
    if (rel === null) continue
    if (typeFilter) {
      const workType = workTypeOf(p)
      if (!isBoardPostingLockedForViewer(p, opts.isCandidatePlus)) countByWorkType[workType]++
      if (!typeFilter.has(workType)) continue
    }
    const facts = rowFacts(p)
    const company = facts.company
    const canOpen = !isBoardPostingLockedForViewer(p, opts.isCandidatePlus)
    const fresh = isFresh(p, now)
    const competition = scoreCompetition(p, countByCompany.get(company) ?? 0, now).level
    const low = competition === 'low'
    const rank = FIT_BUCKET_SORT_RANK[fitBucket(p)]
    // The prompts count only jobs that fit (strong or good).
    if (canOpen && fresh && rank <= 1) freshOpenTotal++
    if (canOpen && low && rank <= 1) lowCompetitionOpenTotal++
    if (opts.view === 'fresh' && !fresh) continue
    if (opts.view === 'low_competition' && !low) continue
    const entry = {
      id: p.id,
      company,
      title: facts.titleKey,
      rank,
      crowd: COMPETITION_SORT_RANK[competition],
      offFunction: functions.has(facts.titleFunction) ? 0 : 1,
      gap: calibratedLevelDistance(candidateLevel, facts.levelRank),
      at: p.createdAt.getTime(),
      rel,
      posted: (p.postedAt ?? p.createdAt).getTime(),
      pay: annualPayForSort(p.salaryMin, p.salaryMax) ?? -1,
    }
    // Everyone can open everything except employer / recruiter exclusives.
    if (canOpen) open.push(entry)
    else locked.push(entry)
  }

  // Best fit first, then own function, least competition, nearest level,
  // newest — but one listing per
  // title per company (big employers post the same role in dozens of
  // places) and at most PER_COMPANY per company, so one employer can't fill
  // the whole list. If that leaves room, the held-back ones fill it.
  const best = (list: typeof open) => {
    const fit = (a: (typeof open)[number], b: (typeof open)[number]) =>
      a.rank - b.rank || a.offFunction - b.offFunction || a.crowd - b.crowd || a.gap - b.gap || b.at - a.at
    // Search: newest / highest pay first, or relevance tier then fit. No search: fit, as always.
    const sorted = list.sort(
      opts.sort === 'newest'
        ? (a, b) => b.posted - a.posted || fit(a, b)
        : opts.sort === 'pay'
          ? (a, b) => b.pay - a.pay || fit(a, b)
          : opts.relevance
            ? (a, b) => a.rel - b.rel || fit(a, b)
            : fit
    )
    const perCompanyCap = opts.perCompany ?? PER_COMPANY
    const picked: string[] = []
    const heldBack: string[] = []
    const seenTitles = new Set<string>()
    const perCompany = new Map<string, number>()
    for (const e of sorted) {
      if (picked.length >= size) break
      const titleKey = `${e.company}|${e.title}`
      if (seenTitles.has(titleKey)) continue
      seenTitles.add(titleKey)
      const n = perCompany.get(e.company) ?? 0
      if (e.company && n >= perCompanyCap) {
        if (heldBack.length < size) heldBack.push(e.id)
        continue
      }
      perCompany.set(e.company, n + 1)
      picked.push(e.id)
    }
    return [...picked, ...heldBack].slice(0, size)
  }

  return {
    openIds: best(open),
    lockedIds: best(locked),
    openTotal: open.length,
    lockedTotal: locked.length,
    freshOpenTotal,
    lowCompetitionOpenTotal,
    countByCompany,
    countByWorkType,
  }
}
