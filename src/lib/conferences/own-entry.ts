import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { canonicalUrlKey } from './canonical'
import { ensureEdition } from './editions'
import { sanitizeExtraction } from './sanitize'
import { canEditEntry } from './entry-rules'

/** An entry the member added by link and we have not approved yet. Only they can change it, and only until then. */
async function ownPending(candidateId: string, seriesId: string) {
  const s = await prisma.conferenceEvent.findUnique({ where: { id: seriesId }, select: { id: true, name: true, addedBy: true, published: true, rejectedAt: true } })
  return s && canEditEntry(s, candidateId) ? s : null
}

/** Saves the member's corrections. Blank fields are cleared (except the name, which keeps its old value). Returns false if it is not theirs to edit. */
export async function updateOwnEntry(candidateId: string, seriesId: string, input: Record<string, unknown>): Promise<boolean> {
  const own = await ownPending(candidateId, seriesId)
  if (!own) return false
  const link = typeof input.url === 'string' ? input.url.trim() : ''
  const urlKey = link ? canonicalUrlKey(link) : null
  const ex = sanitizeExtraction(input, link || 'https://example.invalid')
  const start = ex.startDate ? new Date(`${ex.startDate}T00:00:00Z`) : null
  const end = ex.endDate ? new Date(`${ex.endDate}T00:00:00Z`) : null
  await prisma.conferenceEvent.update({
    where: { id: seriesId },
    data: {
      name: ex.name ?? own.name,
      organizer: ex.organizer,
      ...(urlKey ? { url: link, urlKey } : {}),
      format: ex.format ?? 'IN_PERSON',
      startDate: start, endDate: end, datesConfirmed: !!start,
      city: ex.city, state: ex.state,
      costLow: ex.costLow, costHigh: ex.costHigh, costNote: ex.costNote,
    },
  })
  if (start) {
    const edition = await ensureEdition(seriesId, start.getUTCFullYear())
    await prisma.conferenceEdition.update({ where: { id: edition.id }, data: { startDate: start, endDate: end, status: 'CONFIRMED', city: ex.city, state: ex.state } })
    await prisma.userConference.updateMany({ where: { seriesId }, data: { editionId: edition.id } })
  }
  captureServerEvent(candidateId, 'conference_entry_edited', { seriesId, hasDates: !!start, hasCost: ex.costLow != null || !!ex.costNote })
  return true
}

/** The member removes something we read wrongly from the page (for example a session that is not theirs to apply for). */
export async function removeOwnOpportunity(candidateId: string, opportunityId: string): Promise<boolean> {
  const opp = await prisma.conferenceOpportunity.findUnique({ where: { id: opportunityId }, select: { id: true, seriesId: true, type: true } })
  if (!opp || !(await ownPending(candidateId, opp.seriesId))) return false
  await prisma.conferenceOpportunity.delete({ where: { id: opportunityId } })
  captureServerEvent(candidateId, 'conference_opportunity_removed', { seriesId: opp.seriesId, type: opp.type })
  return true
}
