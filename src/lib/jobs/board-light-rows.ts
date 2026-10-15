import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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

export interface ReconcileResult {
  pages: number
  upserted: number
  deleted: number
  ms: number
}

/**
 * Repairs BoardLightRow against ExclusiveJobPosting, one id range at a time
 * (RECONCILE_PAGE rows per statement, so no single write is large). Returns
 * how many rows had to be written — the drift, 0 while the triggers work.
 * Also the initial fill. Run nightly and after each import finalize.
 */
export async function reconcileBoardLightRows(): Promise<ReconcileResult> {
  const started = Date.now()
  let lo = ''
  let pages = 0
  let upserted = 0
  let deleted = 0
  for (;;) {
    const next = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "ExclusiveJobPosting" WHERE "id" > ${lo} ORDER BY "id" OFFSET ${RECONCILE_PAGE - 1} LIMIT 1`
    const hi = next[0]?.id ?? null
    const [r] = await prisma.$queryRaw<{ upserted: number; deleted: number }[]>`
      SELECT upserted, deleted FROM board_light_row_reconcile(${lo}, ${hi})`
    pages++
    upserted += r?.upserted ?? 0
    deleted += r?.deleted ?? 0
    if (hi === null) break
    lo = hi
  }
  return { pages, upserted, deleted, ms: Date.now() - started }
}
