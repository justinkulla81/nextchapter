import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { ensureEdition } from './editions'
import type { SeenOpportunity } from './changes'

const d = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00Z`) : null)

/**
 * Apply or dismiss a change the weekly re-check found. Members may confirm a change for a series they track unless
 * an admin has locked the series; admins can always confirm. Changes come from our own page reads, never from member input.
 */
export async function resolveChange(changeId: string, action: 'APPLY' | 'DISMISS', actor: { admin: true } | { candidateId: string }): Promise<boolean> {
  const c = await prisma.conferenceChange.findUnique({ where: { id: changeId }, include: { series: { select: { id: true, locked: true, published: true } } } })
  if (!c || c.status !== 'PENDING') return false
  if (!('admin' in actor)) {
    const follows = await prisma.userConference.findUnique({ where: { candidateId_seriesId: { candidateId: actor.candidateId, seriesId: c.seriesId } }, select: { id: true } })
    if (!follows || (action === 'APPLY' && c.series.locked)) return false
  }
  if (action === 'APPLY') {
    const p = c.payload as Record<string, unknown>
    if (c.kind === 'DATES') {
      const start = d(String(p.start)); const end = d(String(p.end))
      if (!start || !end) return false
      await prisma.conferenceEvent.update({ where: { id: c.seriesId }, data: { startDate: start, endDate: end, datesConfirmed: true } })
      const ed = await ensureEdition(c.seriesId, start.getUTCFullYear())
      await prisma.conferenceEdition.update({ where: { id: ed.id }, data: { startDate: start, endDate: end, status: 'CONFIRMED' } })
      // Members planning around a TBA edition move to the one that now has dates.
      await prisma.userConference.updateMany({ where: { seriesId: c.seriesId }, data: { editionId: ed.id } })
    } else if (c.kind === 'NEW_OPPORTUNITY') {
      const o = p.opportunity as SeenOpportunity
      const ed = await prisma.conferenceEdition.findFirst({ where: { seriesId: c.seriesId, status: { in: ['TBA', 'CONFIRMED'] } }, orderBy: { year: 'desc' }, select: { id: true } })
      await prisma.conferenceOpportunity.create({
        data: { seriesId: c.seriesId, editionId: ed?.id ?? null, type: o.type, title: o.title, url: o.url, opensAt: d(o.opensAt), deadline: d(o.deadline), published: c.series.published, source: 'RECHECK' },
      })
    } else if (c.kind === 'OPPORTUNITY_DEADLINE') {
      const target = await prisma.conferenceOpportunity.findFirst({ where: { seriesId: c.seriesId, type: String(p.type), title: String(p.title) }, select: { id: true } })
      if (target) await prisma.conferenceOpportunity.update({ where: { id: target.id }, data: { deadline: d(String(p.to)) } })
    }
  }
  await prisma.conferenceChange.update({ where: { id: changeId }, data: { status: action === 'APPLY' ? 'APPLIED' : 'DISMISSED', resolvedAt: new Date() } })
  captureServerEvent('candidateId' in actor ? actor.candidateId : 'admin', 'conference_change_resolved', { changeId, kind: c.kind, action, by: 'admin' in actor ? 'admin' : 'member' })
  return true
}
