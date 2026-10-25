import 'server-only'
import { prisma } from '@/lib/prisma'
import { conferenceSuggestions, DEADLINE_HORIZON_DAYS, type ConferenceSuggestion } from './sprint'

const DAY = 86_400_000

/** Reads the member's followed conferences and their open deadlines, then asks the pure builder what to suggest. */
export async function loadConferenceSuggestions(candidateId: string, now = new Date()): Promise<ConferenceSuggestion[]> {
  const ucs = await prisma.userConference.findMany({ where: { candidateId, status: { not: 'SKIPPED' } }, select: { seriesId: true, status: true } })
  if (ucs.length === 0) return []
  const ids = ucs.map((u) => u.seriesId)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const [series, opps, tracks] = await Promise.all([
    prisma.conferenceEvent.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, startDate: true, endDate: true, datesConfirmed: true } }),
    prisma.conferenceOpportunity.findMany({
      where: { seriesId: { in: ids }, published: true, deadline: { gte: today, lte: new Date(today.getTime() + DEADLINE_HORIZON_DAYS * DAY) } },
      select: { id: true, seriesId: true, type: true, title: true, deadline: true },
    }),
    prisma.conferenceOpportunityTrack.findMany({ where: { candidateId }, select: { opportunityId: true, status: true } }),
  ])
  const status = new Map(ucs.map((u) => [u.seriesId, u.status]))
  return conferenceSuggestions(
    series.map((s) => ({ seriesId: s.id, name: s.name, status: status.get(s.id)!, startDate: s.startDate, endDate: s.endDate, datesConfirmed: s.datesConfirmed })),
    opps,
    new Map(tracks.map((t) => [t.opportunityId, t.status])),
    now,
  )
}
