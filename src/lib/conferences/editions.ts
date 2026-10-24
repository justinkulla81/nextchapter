import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ConferenceEdition } from '@prisma/client'

export interface EditionFields {
  startDate?: Date | null; endDate?: Date | null; status?: string
  format?: string | null; city?: string | null; state?: string | null; country?: string | null; url?: string | null
}

/** One edition per series per year. Existing rows are left as they are. */
export async function ensureEdition(seriesId: string, year: number, fields: EditionFields = {}): Promise<ConferenceEdition> {
  return prisma.conferenceEdition.upsert({
    where: { seriesId_year: { seriesId, year } },
    create: { seriesId, year, status: 'TBA', ...fields },
    update: {},
  })
}

/**
 * When an edition has ended, create next year's as "Dates TBA" and move every member's tracking of the series onto it.
 * Members keep their status, except Skipped, which goes back to Tracking.
 * Returns the number of series rolled.
 */
export async function rollEditions(now = new Date()): Promise<number> {
  const ended = await prisma.conferenceEdition.findMany({
    where: { status: { in: ['CONFIRMED', 'TBA'] }, OR: [{ endDate: { lt: now } }, { endDate: null, startDate: { lt: now } }] },
    select: { id: true, seriesId: true, year: true },
  })
  let rolled = 0
  for (const e of ended) {
    const next = await ensureEdition(e.seriesId, e.year + 1, { status: 'TBA' })
    await prisma.userConference.updateMany({ where: { seriesId: e.seriesId, OR: [{ editionId: e.id }, { editionId: null }] }, data: { editionId: next.id } })
    // "Skipped" described last year's edition; the series goes back to Tracking. Attended, Speaking and the rest are kept as history.
    await prisma.userConference.updateMany({ where: { seriesId: e.seriesId, editionId: next.id, status: 'SKIPPED' }, data: { status: 'TRACKING' } })
    await prisma.conferenceEdition.update({ where: { id: e.id }, data: { status: 'ENDED' } })
    rolled++
  }
  return rolled
}
