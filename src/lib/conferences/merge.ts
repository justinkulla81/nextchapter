import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Fold a duplicate series into the one to keep. Members tracking both keep the target's row; editions and opportunities
 * that already exist on the target are dropped from the duplicate, the rest move over. The duplicate is deleted last.
 */
export async function mergeSeries(sourceId: string, targetId: string): Promise<boolean> {
  if (sourceId === targetId) return false
  const [src, dst] = await Promise.all([prisma.conferenceEvent.findUnique({ where: { id: sourceId } }), prisma.conferenceEvent.findUnique({ where: { id: targetId } })])
  if (!src || !dst) return false
  await prisma.$transaction(async (tx) => {
    // Member tracking and the older interest rows.
    const have = new Set((await tx.userConference.findMany({ where: { seriesId: targetId }, select: { candidateId: true } })).map((r) => r.candidateId))
    const srcUcs = await tx.userConference.findMany({ where: { seriesId: sourceId } })
    for (const u of srcUcs) {
      if (have.has(u.candidateId)) await tx.userConference.delete({ where: { id: u.id } })
      else await tx.userConference.update({ where: { id: u.id }, data: { seriesId: targetId, editionId: null } })
    }
    const haveI = new Set((await tx.conferenceInterest.findMany({ where: { eventId: targetId }, select: { candidateId: true } })).map((r) => r.candidateId))
    for (const i of await tx.conferenceInterest.findMany({ where: { eventId: sourceId } })) {
      if (haveI.has(i.candidateId)) await tx.conferenceInterest.delete({ where: { id: i.id } })
      else await tx.conferenceInterest.update({ where: { id: i.id }, data: { eventId: targetId } })
    }
    // Editions: one per year.
    const years = new Map((await tx.conferenceEdition.findMany({ where: { seriesId: targetId }, select: { id: true, year: true } })).map((e) => [e.year, e.id]))
    for (const e of await tx.conferenceEdition.findMany({ where: { seriesId: sourceId } })) {
      const existing = years.get(e.year)
      if (existing) {
        await tx.conferenceOpportunity.updateMany({ where: { editionId: e.id }, data: { editionId: existing } })
        await tx.userConference.updateMany({ where: { editionId: e.id }, data: { editionId: existing } })
        await tx.conferenceEdition.delete({ where: { id: e.id } })
      } else {
        await tx.conferenceEdition.update({ where: { id: e.id }, data: { seriesId: targetId } })
      }
    }
    // Opportunities: skip ones the target already lists (same type and link, or same type and title).
    const dstOpps = await tx.conferenceOpportunity.findMany({ where: { seriesId: targetId }, select: { type: true, url: true, title: true } })
    for (const o of await tx.conferenceOpportunity.findMany({ where: { seriesId: sourceId }, include: { tracks: true } })) {
      const dup = dstOpps.some((d) => d.type === o.type && ((d.url && d.url === o.url) || d.title.toLowerCase() === o.title.toLowerCase()))
      if (dup) await tx.conferenceOpportunity.delete({ where: { id: o.id } })
      else await tx.conferenceOpportunity.update({ where: { id: o.id }, data: { seriesId: targetId } })
    }
    await tx.conferenceChange.updateMany({ where: { seriesId: sourceId }, data: { seriesId: targetId } })
    await tx.conferenceTalk.updateMany({ where: { seriesId: sourceId }, data: { seriesId: targetId } })
    // The target keeps its own facts, but fills any it is missing from the duplicate.
    await tx.conferenceEvent.update({
      where: { id: targetId },
      data: {
        organizer: dst.organizer ?? src.organizer, url: dst.url ?? src.url, urlKey: dst.urlKey ?? src.urlKey, whyAttend: dst.whyAttend ?? src.whyAttend,
        industries: dst.industries.length ? dst.industries : src.industries, functions: dst.functions.length ? dst.functions : src.functions,
        seniorities: dst.seniorities.length ? dst.seniorities : src.seniorities,
      },
    })
    await tx.conferenceEvent.delete({ where: { id: sourceId } })
  }, { timeout: 60_000, maxWait: 10_000 })
  return true
}
