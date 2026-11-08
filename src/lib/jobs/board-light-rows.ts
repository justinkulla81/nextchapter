import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withStatementTimeout } from '@/lib/db/statement-timeout'

// Where the board reads its light rows from.
//
// ExclusiveJobPosting is wide (descriptions, ~1 KB a row) and every import
// rewrites every row, so reading all ~160k live rows' light columns from it
// took 11-15 s even with every page in memory. BoardLightRow is a narrow copy
// of just the light and filter columns (~230 bytes a row, small enough to stay
// in Postgres' buffer cache), kept in step by triggers on ExclusiveJobPosting
// in the same transaction as every write — the same rows, never stale
// (prisma/manual/2026-10-14-board-light-row.sql). Reading it takes ~0.1 s.
//
// Falls back to the wide table, exactly as before, when the copy can't serve:
// the table or one of its three triggers is missing or disabled, the query
// filters on a column the copy doesn't have, or BOARD_LIGHT_ROWS=off.

/** The light columns the board ranks on — every one is also a BoardLightRow column (see the type check below). */
export const LIGHT_SELECT = {
  id: true,
  title: true,
  companyName: true,
  audienceTier: true,
  source: true,
  targetFunction: true,
  targetLevel: true,
  targetRemotePolicy: true,
  targetLocation: true,
  location: true,
  level: true,
  sourceCategory: true,
  postedAt: true,
  sourceCount: true,
  salaryMin: true,
  salaryMax: true,
  createdAt: true,
  employmentType: true,
  // Sector filter / member sector preference (employer-sector.ts) and the
  // requirement filters (hide hard blockers, cleared jobs — requirements.ts).
  employerSector: true,
  requirementTags: true,
} satisfies Prisma.ExclusiveJobPostingSelect & Prisma.BoardLightRowSelect

export type LightRow = Prisma.ExclusiveJobPostingGetPayload<{ select: typeof LIGHT_SELECT }>

// Compile-time guard: a light column added to LIGHT_SELECT must also be added to
// BoardLightRow (and its triggers), with the same type.
type MirrorRow = Prisma.BoardLightRowGetPayload<{ select: typeof LIGHT_SELECT }>
const sameShape: [LightRow, MirrorRow] extends [MirrorRow, LightRow] ? true : never = true
void sameShape

/** ExclusiveJobPosting columns BoardLightRow also holds — a where on only these can be answered by it. */
export const MIRROR_COLUMNS = new Set<string>([
  ...Object.keys(LIGHT_SELECT),
  'status',
  'archivedAt',
  'institutionScopeId',
  'distribution',
  'expiresAt',
])

/** Whether every condition in a where is on a BoardLightRow column (AND / OR / NOT of plain column filters). */
export function mirrorCanAnswer(where: unknown): boolean {
  if (where === undefined || where === null) return true
  if (Array.isArray(where)) return where.every(mirrorCanAnswer)
  if (typeof where !== 'object') return false
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      if (!mirrorCanAnswer(value)) return false
    } else if (!MIRROR_COLUMNS.has(key)) {
      return false
    }
  }
  return true
}

export function mirrorDisabledByEnv(env: Record<string, string | undefined> = process.env): boolean {
  return env.BOARD_LIGHT_ROWS === 'off'
}

const TRIGGERS = ['BoardLightRow_sync_insert', 'BoardLightRow_sync_update', 'BoardLightRow_sync_delete']
const READY_TTL_MS = 60_000
let ready: { at: number; ok: Promise<boolean> } | null = null

/** The copy exists and all three triggers are enabled — checked once a minute per server instance. */
export function boardLightRowsReady(): Promise<boolean> {
  if (mirrorDisabledByEnv()) return Promise.resolve(false)
  if (!ready || Date.now() - ready.at > READY_TTL_MS) {
    const ok = prisma
      .$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_trigger
        WHERE tgrelid = to_regclass('"ExclusiveJobPosting"') AND tgenabled <> 'D' AND tgname = ANY(${TRIGGERS})
          AND to_regclass('"BoardLightRow"') IS NOT NULL`
      .then((r) => r[0]?.n === TRIGGERS.length)
      .catch((error) => {
        console.error('Board light rows: readiness check failed, reading the wide table', error)
        return false
      })
    ready = { at: Date.now(), ok }
  }
  return ready.ok
}

/**
 * Light rows matching a where (written against ExclusiveJobPosting) — from
 * BoardLightRow when it can answer, else from ExclusiveJobPosting. No order.
 */
export async function findLightRows(where: Prisma.ExclusiveJobPostingWhereInput): Promise<LightRow[]> {
  if (mirrorCanAnswer(where) && (await boardLightRowsReady())) {
    try {
      // Same column names and types, so the same where means the same rows.
      return await prisma.boardLightRow.findMany({ where: where as Prisma.BoardLightRowWhereInput, select: LIGHT_SELECT })
    } catch (error) {
      console.error('Board light rows: read failed, reading the wide table', error)
    }
  }
  return prisma.exclusiveJobPosting.findMany({ where, select: LIGHT_SELECT })
}

/** One log line of the instance's memory after a big in-memory load, so Vercel's logs show what the board costs. */
export function logBoardMemory(label: string, detail: Record<string, number>): void {
  const m = process.memoryUsage()
  const mb = (n: number) => Math.round(n / 1_048_576)
  console.log(`[board-memory] ${label}`, JSON.stringify({ ...detail, rssMB: mb(m.rss), heapUsedMB: mb(m.heapUsed), externalMB: mb(m.external) }))
}

/**
 * One id-ordered page of findLightRows: rows with an id after `afterId`, at most `take`.
 * Loading the board a page at a time keeps one page (not the whole table, its filtered
 * copy and its sorted copy) in memory beside the rows the board keeps.
 */
export async function findLightRowsPage(
  where: Prisma.ExclusiveJobPostingWhereInput,
  afterId: string | null,
  take: number
): Promise<(LightRow & { expiresAt: Date | null })[]> {
  const paged: Prisma.ExclusiveJobPostingWhereInput = afterId === null ? where : { AND: [where, { id: { gt: afterId } }] }
  // expiresAt too: the shared board drops a job the moment it expires (board-shortlist.ts stillLive).
  const select = { ...LIGHT_SELECT, expiresAt: true } as const
  if (mirrorCanAnswer(paged) && (await boardLightRowsReady())) {
    try {
      return await prisma.boardLightRow.findMany({ where: paged as Prisma.BoardLightRowWhereInput, select, orderBy: { id: 'asc' }, take })
    } catch (error) {
      console.error('Board light rows: page read failed, reading the wide table', error)
    }
  }
  return prisma.exclusiveJobPosting.findMany({ where: paged, select, orderBy: { id: 'asc' }, take })
}

/**
 * Closed (archived) postings per company + title + location, the input to
 * ghost risk. Ordered, so callers that fold groups differing only in case or
 * spacing into one key always keep the same one.
 */
export async function groupClosedPostings(): Promise<{ companyName: string; title: string; location: string | null; count: number }[]> {
  if (await boardLightRowsReady()) {
    try {
      const rows = await prisma.boardLightRow.groupBy({
        by: ['companyName', 'title', 'location'],
        where: { archivedAt: { not: null } },
        _count: { _all: true },
        orderBy: [{ companyName: 'asc' }, { title: 'asc' }, { location: 'asc' }],
      })
      return rows.map((r) => ({ companyName: r.companyName, title: r.title, location: r.location, count: r._count._all }))
    } catch (error) {
      console.error('Board light rows: closed-postings read failed, reading the wide table', error)
    }
  }
  const rows = await prisma.exclusiveJobPosting.groupBy({
    by: ['companyName', 'title', 'location'],
    where: { archivedAt: { not: null } },
    _count: { _all: true },
    orderBy: [{ companyName: 'asc' }, { title: 'asc' }, { location: 'asc' }],
  })
  return rows.map((r) => ({ companyName: r.companyName, title: r.title, location: r.location, count: r._count._all }))
}

const RECONCILE_PAGE = 20_000
/** One page (a 20,000-id range) gets this long in the database; a page that cannot finish is skipped, not waited for. */
const RECONCILE_PAGE_TIMEOUT_MS = 90_000
/** A progress note goes to the cron ledger every this many pages. */
const PROGRESS_EVERY_PAGES = 4
/** The skipped pages listed in the result, so a bad night names where it hurt. */
const MAX_LISTED_SKIPS = 10

export interface ReconcileProgress {
  pages: number
  /** The id the next page starts after: a retry of a cut-off run resumes here. null when the run reached the end. */
  nextId: string | null
  upserted: number
  deleted: number
  failedPages: number
  ms: number
}

export interface ReconcileResult extends ReconcileProgress {
  /** false when the time budget ran out, or the end of a page could not be found, before the last page. */
  complete: boolean
  /** Pages (by their first id) skipped because their write failed: a lock timeout, a deadlock or the page time limit. */
  skipped: string[]
}

/**
 * Repairs BoardLightRow against ExclusiveJobPosting, one id range at a time
 * (RECONCILE_PAGE rows per statement, so no single write is large). Returns
 * how many rows had to be written — the drift, 0 while the triggers work.
 * Also the initial fill. Run nightly and after each import finalize.
 *
 * A page that fails (board_light_row_reconcile gives up on a lock after 5 s, a deadlock, the 90 s page limit) is skipped and counted;
 * the next night repairs it. `startAfter` resumes a cut-off run, and `onProgress` lets the caller leave a note every few pages.
 */
const RECONCILE_PAUSE_MS = 250

export async function reconcileBoardLightRows(
  opts: { budgetMs?: number; startAfter?: string | null; onProgress?: (p: ReconcileProgress) => Promise<void> | void; pauseMs?: number } = {}
): Promise<ReconcileResult> {
  const started = Date.now()
  let lo = opts.startAfter ?? ''
  let pages = 0
  let upserted = 0
  let deleted = 0
  let failedPages = 0
  const skipped: string[] = []
  const snapshot = (nextId: string | null): ReconcileProgress => ({ pages, nextId, upserted, deleted, failedPages, ms: Date.now() - started })
  const describe = (error: unknown) => (error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200))
  for (;;) {
    // Out of time: stop between pages instead of being cut off mid-statement (an orphaned statement keeps running in Postgres and
    // deadlocks the watchdog's retry, 2026-11-06). The triggers keep the copy in step; the next night repairs the rest.
    if (opts.budgetMs !== undefined && Date.now() - started > opts.budgetMs) {
      console.error('Board light rows: reconcile stopped at its time budget', { pages, lo })
      return { ...snapshot(lo), complete: false, skipped }
    }
    let hi: string | null
    try {
      const next = await withStatementTimeout(
        prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ExclusiveJobPosting" WHERE "id" > ${lo} ORDER BY "id" OFFSET ${RECONCILE_PAGE - 1} LIMIT 1`,
        RECONCILE_PAGE_TIMEOUT_MS
      )
      hi = next[0]?.id ?? null
    } catch (error) {
      // Without the end of the page there is no page to repair: stop here, and a retry resumes from `lo`.
      failedPages++
      console.error('Board light rows: could not find the end of a page, stopping', { lo, message: describe(error) })
      return { ...snapshot(lo), complete: false, skipped }
    }
    try {
      const [r] = await withStatementTimeout(
        prisma.$queryRaw<{ upserted: number; deleted: number }[]>`SELECT upserted, deleted FROM board_light_row_reconcile(${lo}, ${hi})`,
        RECONCILE_PAGE_TIMEOUT_MS
      )
      upserted += r?.upserted ?? 0
      deleted += r?.deleted ?? 0
    } catch (error) {
      failedPages++
      if (skipped.length < MAX_LISTED_SKIPS) skipped.push(lo)
      console.error('Board light rows: a page was skipped, the next night repairs it', { lo, hi, message: describe(error) })
    }
    pages++
    if (hi === null) break
    lo = hi
    if (opts.onProgress && pages % PROGRESS_EVERY_PAGES === 0) {
      try {
        await opts.onProgress(snapshot(lo))
      } catch {
        // A progress note must never stop the repair.
      }
    }
    // A pause between pages: the night this ran flat out for 12 minutes (2026-11-04, 09:40 to 09:52 UTC) the members' pages stalled for
    // the same minutes. About 60 pages, so this adds about 15 s to the run.
    await new Promise((resolve) => setTimeout(resolve, opts.pauseMs ?? RECONCILE_PAUSE_MS))
  }
  return { ...snapshot(null), complete: true, skipped }
}

/**
 * Where a cut-off or failed earlier run stopped, so its retry carries on from there instead of starting over: the id in the progress note
 * the run left on its ledger row (CronRun.detail). null for a run that finished, is old (the retry window is six hours) or left no note.
 */
export function resumePointFrom(prev: { status: string; startedAt: Date; detail: string | null } | null, now: Date = new Date()): string | null {
  if (!prev || (prev.status !== 'TIMED_OUT' && prev.status !== 'FAILED') || !prev.detail) return null
  if (now.getTime() - prev.startedAt.getTime() > 6 * 3_600_000) return null
  try {
    const note = JSON.parse(prev.detail) as { nextId?: unknown }
    return typeof note.nextId === 'string' && note.nextId !== '' ? note.nextId : null
  } catch {
    // The note is cut at 2,000 characters; ours is far shorter, so anything unreadable is not ours.
    return null
  }
}

/** The resume point left by the latest finished run of the nightly job, for its watchdog retry. */
export async function loadReconcileResumePoint(now: Date = new Date()): Promise<string | null> {
  const prev = await prisma.cronRun.findFirst({
    where: { job: 'board-light-rows', status: { not: 'RUNNING' } },
    orderBy: { startedAt: 'desc' },
    select: { status: true, startedAt: true, detail: true },
  })
  return resumePointFrom(prev, now)
}
