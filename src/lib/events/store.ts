import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ConferenceRow } from './types'

/**
 * ConferenceEvent reads and writes. The table is applied by hand (prisma/manual/conference-events.sql),
 * so each function throws when it is missing and callers decide what to show.
 */

export async function listEvents(opts: { publishedOnly?: boolean } = {}): Promise<ConferenceRow[]> {
  return (await prisma.conferenceEvent.findMany({
    where: opts.publishedOnly ? { published: true } : undefined,
    orderBy: [{ importance: 'asc' }, { startDate: 'asc' }, { name: 'asc' }],
  })) as ConferenceRow[]
}

export async function getEvent(id: string): Promise<ConferenceRow | null> {
  return (await prisma.conferenceEvent.findUnique({ where: { id } })) as ConferenceRow | null
}

/** Saves, going and speaking counts per event, for the CRM. */
export async function interestCounts(): Promise<Record<string, { saved: number; going: number; speaking: number; following: number; attended: number; spoke: number }>> {
  const rows = await prisma.conferenceInterest.groupBy({ by: ['eventId', 'status'], _count: { _all: true }, _sum: { attendedCount: true, spokeCount: true } })
  const out: Record<string, { saved: number; going: number; speaking: number; following: number; attended: number; spoke: number }> = {}
  for (const r of rows) {
    const o = (out[r.eventId] ??= { saved: 0, going: 0, speaking: 0, following: 0, attended: 0, spoke: 0 })
    if (r.status === 'SAVED') o.saved = r._count._all
    else if (r.status === 'GOING') o.going = r._count._all
    else if (r.status === 'SPEAKING') o.speaking = r._count._all
    else if (r.status === 'FOLLOWING') o.following = r._count._all
    o.attended += r._sum.attendedCount ?? 0
    o.spoke += r._sum.spokeCount ?? 0
  }
  return out
}

/** Events the member marked whose edition has ended and who has not said how it went. */
export async function pendingCheckIns(candidateId: string, now = new Date()): Promise<{ eventId: string; name: string }[]> {
  const rows = await prisma.conferenceInterest.findMany({
    where: { candidateId, outcome: null, status: { not: 'FOLLOWING' }, editionEnd: { lt: new Date(now.getTime() - 86_400_000) } },
    select: { eventId: true, event: { select: { name: true } } },
    orderBy: { editionEnd: 'desc' },
    take: 3,
  })
  return rows.map((r) => ({ eventId: r.eventId, name: r.event.name }))
}

export async function memberInterests(candidateId: string): Promise<Record<string, string>> {
  const rows = await prisma.conferenceInterest.findMany({ where: { candidateId }, select: { eventId: true, status: true } })
  return Object.fromEntries(rows.map((r) => [r.eventId, r.status]))
}

const COLS = [
  'name', 'organizer', 'url', 'kind', 'format', 'startDate', 'endDate', 'datesConfirmed', 'typicalMonth', 'city', 'state', 'country',
  'industries', 'functions', 'segments', 'journeys', 'programFormats', 'roles', 'seniorities', 'importance', 'whyAttend', 'access', 'costLow', 'costHigh', 'costNote',
  'speaking', 'speakingUrl', 'speakingDeadline', 'speakingNote', 'cheaperWays', 'applyUrl', 'applyDeadline', 'published', 'verified', 'checkedAt', 'source', 'adminNote',
] as const

/** Upsert catalog rows in one statement per chunk. Rows an admin edited (locked) are left exactly as they are. */
export async function upsertCatalogRows(rows: Record<string, unknown>[]): Promise<number> {
  const set = COLS.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
  const now = new Date().toISOString()
  let written = 0
  for (let i = 0; i < rows.length; i += 250) {
    // Every NOT NULL column is given here: jsonb_populate_recordset fills missing keys with NULL, not the column default.
    const chunk = rows.slice(i, i + 250).map((r) => ({ segments: [], roles: [], journeys: [], programFormats: [], industries: [], functions: [], seniorities: [], linkFailures: 0, ...r, locked: false, createdAt: now, updatedAt: now }))
    written += await prisma.$executeRawUnsafe(
      `INSERT INTO "ConferenceEvent" SELECT * FROM jsonb_populate_recordset(null::"ConferenceEvent", $1::jsonb)
       ON CONFLICT ("id") DO UPDATE SET ${set}, "updatedAt" = EXCLUDED."updatedAt"
       WHERE "ConferenceEvent"."locked" = false`,
      JSON.stringify(chunk),
    )
  }
  return written
}

/**
 * Loads the catalog bundled with the app (src/lib/events/catalog.json, built by scripts/events/build-catalog.ts).
 * Rows an admin edited (locked) are never overwritten. Runs when the table is empty or was last written before
 * the catalog was built, so a catalog update reaches production on the next admin visit.
 */
export async function seedCatalogIfStale(): Promise<number> {
  const [{ n, last }] = await prisma.$queryRaw<{ n: bigint; last: Date | null }[]>`SELECT COUNT(*) AS n, MAX("updatedAt") AS last FROM "ConferenceEvent"`
  const catalog = (await import('./catalog.json')).default as unknown as { builtAt: string; rows: Record<string, unknown>[] }
  if (Number(n) > 0 && last && last >= new Date(catalog.builtAt)) return 0
  return upsertCatalogRows(catalog.rows)
}
