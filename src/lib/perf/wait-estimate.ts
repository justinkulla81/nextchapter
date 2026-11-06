import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MIN_WAIT_SAMPLES, WAIT_LIMIT_MS, type WaitOp } from '@/lib/perf/thinking-timer'

// How long recent waits of one kind really took, read from the Postgres copy of our own events (AnalyticsEvent, written by
// captureServerEvent and the page-slow beacon), so the "Thinking…" clock needs no table of its own.
//   resume_parse: resume_parse_completed.durationMs (upload stored -> profile filled in)
//   retune:       search_retuned.ms (the server's re-matching run)
//   page:         page_load_finished.waitedMs (only waits past 4 s are reported, so this is "how long a slow page took")
const SOURCES: Record<WaitOp, { event: string; field: string }> = {
  resume_parse: { event: 'resume_parse_completed', field: 'durationMs' },
  retune: { event: 'search_retuned', field: 'ms' },
  page: { event: 'page_load_finished', field: 'waitedMs' },
}

const WINDOW_DAYS = 7
const CACHE_MS = 5 * 60_000

export interface WaitEstimate {
  /** The 95th percentile of recent waits in milliseconds, or null when there are too few to say. */
  p95Ms: number | null
  samples: number
}

const cache = new Map<WaitOp, { at: number; value: WaitEstimate }>()

export async function waitEstimate(op: WaitOp, now: number = Date.now()): Promise<WaitEstimate> {
  const hit = cache.get(op)
  if (hit && now - hit.at < CACHE_MS) return hit.value
  const { event, field } = SOURCES[op]
  let value: WaitEstimate = { p95Ms: null, samples: 0 }
  try {
    // The field name and the window are fixed values from this file (never input), so they go in as literals: a bound
    // parameter inside ->> or make_interval has no type Postgres can infer.
    const col = Prisma.raw(`properties ->> '${field}'`)
    const rows = await prisma.$queryRaw<{ n: number; p95: number | null }[]>(Prisma.sql`
      SELECT count(*)::int AS n,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY (${col})::float8) AS p95
      FROM "AnalyticsEvent"
      WHERE event = ${event}::text
        AND "createdAt" > now() - ${Prisma.raw(`interval '${WINDOW_DAYS} days'`)}
        AND ${col} ~ '^[0-9]+([.][0-9]+)?$'`)
    const row = rows[0]
    const samples = Number(row?.n ?? 0)
    const raw = samples >= MIN_WAIT_SAMPLES && row?.p95 != null ? Math.round(Number(row.p95)) : null
    value = { p95Ms: raw === null ? null : Math.min(raw, WAIT_LIMIT_MS[op] ?? raw), samples }
  } catch (error) {
    // The clock is decoration: without an estimate it counts up.
    console.error('Wait estimate unavailable:', error)
    return value
  }
  cache.set(op, { at: now, value })
  return value
}
