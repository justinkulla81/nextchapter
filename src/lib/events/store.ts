import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
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
export async function interestCounts(): Promise<Record<string, { saved: number; going: number; speaking: number }>> {
  const rows = await prisma.conferenceInterest.groupBy({ by: ['eventId', 'status'], _count: { _all: true } })
  const out: Record<string, { saved: number; going: number; speaking: number }> = {}
  for (const r of rows) {
    const o = (out[r.eventId] ??= { saved: 0, going: 0, speaking: 0 })
    if (r.status === 'SAVED') o.saved = r._count._all
    else if (r.status === 'GOING') o.going = r._count._all
    else if (r.status === 'SPEAKING') o.speaking = r._count._all
  }
  return out
}

export async function memberInterests(candidateId: string): Promise<Record<string, string>> {
  const rows = await prisma.conferenceInterest.findMany({ where: { candidateId }, select: { eventId: true, status: true } })
  return Object.fromEntries(rows.map((r) => [r.eventId, r.status]))
}

type CatalogRow = Omit<ConferenceRow, 'startDate' | 'endDate' | 'speakingDeadline' | 'applyDeadline' | 'checkedAt' | 'locked' | 'adminNote'> & {
  startDate: string | null
  endDate: string | null
  speakingDeadline: string | null
  applyDeadline: string | null
  checkedAt: string | null
}

const d = (s: string | null) => (s ? new Date(s) : null)

/**
 * Loads the catalog bundled with the app (src/lib/events/catalog.json, built by scripts/events/build-catalog.ts).
 * New ids are added unpublished unless the catalog says verified; rows an admin edited (locked) are never
 * overwritten. Runs when the table is empty or was last written before the catalog was built.
 */
export async function seedCatalogIfStale(): Promise<number> {
  const [{ n, last }] = await prisma.$queryRaw<{ n: bigint; last: Date | null }[]>`SELECT COUNT(*) AS n, MAX("updatedAt") AS last FROM "ConferenceEvent"`
  const catalog = (await import('./catalog.json')).default as unknown as { builtAt: string; rows: CatalogRow[] }
  if (Number(n) > 0 && last && last >= new Date(catalog.builtAt)) return 0
  const existing = new Map((await prisma.conferenceEvent.findMany({ select: { id: true, locked: true } })).map((r) => [r.id, r.locked]))
  let written = 0
  for (const r of catalog.rows) {
    if (existing.get(r.id) === true) continue
    const data = {
      ...r,
      startDate: d(r.startDate), endDate: d(r.endDate), speakingDeadline: d(r.speakingDeadline), applyDeadline: d(r.applyDeadline), checkedAt: d(r.checkedAt),
    } satisfies Prisma.ConferenceEventUncheckedCreateInput
    const { id, ...rest } = data
    await prisma.conferenceEvent.upsert({ where: { id }, create: data, update: rest })
    written++
  }
  return written
}
