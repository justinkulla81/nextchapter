import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { memoTtl, sharedLoad } from '@/lib/db/heavy'

// Figures that take a pass over the whole open board are computed by the cron /api/cron/board-figures and stored in
// BoardFigure. Pages read the stored row (a primary-key lookup) instead of running the scan themselves.
// A key is a fixed name, or a prefix and an id (one row per job title, per search firm, ...).
export type BoardFigureKey =
  | 'employer-rankings'
  | 'function-rankings'
  | 'workforce-jobs'
  | 'exposure-rows'
  | 'places-job-aggregate'
  | 'job-title-stats'
  | 'job-type-summaries'
  | `job-title:${string}`
  | 'ranking-index'
  | 'ranking-places'
  | 'ranking-method'
  | `ranking-awards:${number}`
  | `ranking:${string}`
  | 'segment-index'
  | `segment:${string}`
  | `segment-awards:${number}`
  | 'job-title-places-index'
  | `job-title-place:${string}`
  | 'pay-data'
  | 'entry-role-stats'
  | `entry-role:${string}`
  | 'entry-role-places-index'
  | `entry-role-place:${string}`
  | 'role-index'
  | `org-job-stats:${string}`
  | 'fresh-job-counts'
  | `role:${string}`
  | `pay-data-snapshot:${string}`

/**
 * A figure is read from the shared data cache (30 minutes) through a five-minute copy on the instance: pages read these on every
 * render (~1.9M reads of ~4.5 KB payloads in five days, owner decision 2026-11-17, Supabase egress). The crons that write them run
 * hourly or daily, so a page shows a new figure within half an hour.
 */
const readFigurePayload = memoTtl(5 * 60_000, (key: string) => key, (key: string) =>
  sharedLoad(`board-figure-v1:${key}`, 30 * 60, async () => {
    const row = await prisma.boardFigure.findUnique({ where: { key }, select: { payload: true } })
    return row ? row.payload : null
  }, { reviveDates: false }))

export async function readBoardFigure<T>(key: BoardFigureKey): Promise<T | null> {
  const payload = await readFigurePayload(key)
  return payload == null ? null : (payload as unknown as T)
}

export async function writeBoardFigure(key: BoardFigureKey, payload: unknown): Promise<void> {
  const data = payload as object
  await prisma.boardFigure.upsert({
    where: { key },
    create: { key, payload: data, computedAt: new Date() },
    update: { payload: data, computedAt: new Date() },
  })
}

/** Writes many rows (one statement per chunk) and removes rows under `prefix` that are no longer in the set. */
export async function replaceBoardFigures(prefix: string, rows: [key: BoardFigureKey, payload: unknown][], chunk = 200): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk)
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "BoardFigure" ("key", "payload", "computedAt")
      SELECT k, p::jsonb, now() FROM unnest(${part.map(([k]) => k)}::text[], ${part.map(([, p]) => JSON.stringify(p))}::text[]) AS u(k, p)
      ON CONFLICT ("key") DO UPDATE SET "payload" = EXCLUDED."payload", "computedAt" = EXCLUDED."computedAt"`)
  }
  await prisma.boardFigure.deleteMany({ where: { key: { startsWith: prefix, notIn: rows.map(([k]) => k) } } })
}
