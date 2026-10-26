import 'server-only'
import { prisma } from '@/lib/prisma'
import { ACTIONABLE_TYPES, type OpportunityType } from './constants'
import { predictWindows, remindMonth, windowSentence, type Window } from './windows'
import { OPPORTUNITY_LABEL } from './constants'

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

export async function myConferences(candidateId: string) {
  const rows = await prisma.userConference.findMany({ where: { candidateId }, orderBy: { updatedAt: 'desc' } })
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.seriesId)
  const [series, editions, changes, tracks] = await Promise.all([
    prisma.conferenceEvent.findMany({ where: { id: { in: ids } } }),
    prisma.conferenceEdition.findMany({ where: { seriesId: { in: ids }, status: { in: ['TBA', 'CONFIRMED'] } }, orderBy: { year: 'desc' } }),
    prisma.conferenceChange.groupBy({ by: ['seriesId'], where: { seriesId: { in: ids }, status: 'PENDING' }, _count: { _all: true } }),
    prisma.conferenceOpportunityTrack.findMany({ where: { candidateId, opportunity: { seriesId: { in: ids } } }, select: { status: true, opportunity: { select: { seriesId: true } } } }),
  ])
  const sById = new Map(series.map((s) => [s.id, s]))
  return rows.flatMap((r) => {
    const s = sById.get(r.seriesId)
    if (!s) return []
    const edition = editions.find((e) => e.seriesId === r.seriesId) ?? null
    return [{
      uc: r, series: s, edition,
      pendingChanges: changes.find((c) => c.seriesId === r.seriesId)?._count._all ?? 0,
      activeOpportunities: tracks.filter((t) => t.opportunity.seriesId === r.seriesId && ['WATCHING', 'DRAFTING', 'SUBMITTED'].includes(t.status)).length,
    }]
  })
}

export interface OpportunityFilters { type?: OpportunityType; industry?: string; mine?: boolean; includePast?: boolean }

/** Every published opportunity, soonest deadline first (no-deadline ones last). Past deadlines are hidden unless asked for. */
export async function opportunitiesView(candidateId: string, f: OpportunityFilters = {}, now = new Date()) {
  const today = startOfDay(now)
  const mineIds = f.mine ? (await prisma.userConference.findMany({ where: { candidateId }, select: { seriesId: true } })).map((r) => r.seriesId) : null
  const rows = await prisma.conferenceOpportunity.findMany({
    where: {
      published: true,
      ...(f.type ? { type: f.type } : {}),
      ...(f.includePast ? {} : { OR: [{ deadline: null }, { deadline: { gte: today } }] }),
      series: { published: true, ...(f.industry ? { OR: [{ industries: { has: f.industry } }, { industries: { isEmpty: true } }] } : {}) },
      ...(mineIds ? { seriesId: { in: mineIds } } : {}),
    },
    include: { series: { select: { id: true, name: true, industries: true, functions: true, startDate: true, typicalMonth: true } }, tracks: { where: { candidateId }, select: { status: true } } },
    take: 400,
  })
  return rows
    .sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity) || a.series.name.localeCompare(b.series.name))
    .map((o) => ({ ...o, myStatus: o.tracks[0]?.status ?? null, daysLeft: o.deadline ? Math.ceil((o.deadline.getTime() - now.getTime()) / DAY) : null }))
}

export async function seriesDetail(candidateId: string, id: string) {
  const series = await prisma.conferenceEvent.findUnique({ where: { id } })
  if (!series || series.rejectedAt) return null
  const uc = await prisma.userConference.findUnique({ where: { candidateId_seriesId: { candidateId, seriesId: id } }, include: { contactsMet: true } })
  // Unpublished entries (a Quick Add awaiting review) are visible only to members tracking them.
  if (!series.published && !uc) return null
  const [editions, opportunities, tracks, changes, talks] = await Promise.all([
    prisma.conferenceEdition.findMany({ where: { seriesId: id }, orderBy: { year: 'desc' } }),
    prisma.conferenceOpportunity.findMany({ where: { seriesId: id, ...(series.published ? { published: true } : {}) }, orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }] }),
    prisma.conferenceOpportunityTrack.findMany({ where: { candidateId, opportunity: { seriesId: id } } }),
    uc ? prisma.conferenceChange.findMany({ where: { seriesId: id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
    prisma.conferenceTalk.findMany({ where: { candidateId, seriesId: id }, orderBy: { deliveredOn: 'desc' } }),
  ])
  const contactIds = uc?.contactsMet.map((c) => c.contactId) ?? []
  const contacts = contactIds.length ? await prisma.supportNetworkContact.findMany({ where: { id: { in: contactIds }, candidateId }, select: { id: true, name: true, company: true } }) : []
  const history = await prisma.conferenceOpportunity.findMany({ where: { seriesId: id, published: true }, select: { type: true, opensAt: true, deadline: true } })
  const windows = predictWindows(history)
  return { series, uc, editions, opportunities, tracks, changes, talks, contacts, windows, windowLines: windows.flatMap((w) => windowSentence(OPPORTUNITY_LABEL[w.type as OpportunityType] ?? w.type, w) ?? []) }
}

/** Series members with your target function are tracking, shown only when at least 5 people do (never a count for a tiny group). */
export async function trackedByPeers(candidateId: string, targetFunction: string | null, limit = 6): Promise<{ seriesId: string; name: string }[]> {
  if (!targetFunction) return []
  const peers = await prisma.candidateProfile.findMany({ where: { OR: [{ targetFunction }, { primaryFunction: targetFunction }], NOT: { id: candidateId } }, select: { id: true }, take: 5000 })
  if (peers.length < 5) return []
  const groups = await prisma.userConference.groupBy({
    by: ['seriesId'], where: { candidateId: { in: peers.map((p) => p.id) }, status: { notIn: ['SKIPPED'] } },
    _count: { _all: true }, having: { seriesId: { _count: { gte: 5 } } }, orderBy: { _count: { seriesId: 'desc' } }, take: limit * 2,
  }).catch(() => [])
  if (groups.length === 0) return []
  const mine = new Set((await prisma.userConference.findMany({ where: { candidateId }, select: { seriesId: true } })).map((r) => r.seriesId))
  const rows = await prisma.conferenceEvent.findMany({ where: { id: { in: groups.map((g) => g.seriesId) }, published: true }, select: { id: true, name: true } })
  const rank = new Map(groups.map((g, i) => [g.seriesId, i]))
  return rows.filter((r) => !mine.has(r.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!).slice(0, limit).map((r) => ({ seriesId: r.id, name: r.name }))
}

export interface PlanItem { id: string; kind: 'deadline' | 'conference' | 'opens_soon' | 'log_people'; title: string; subtitle: string; date: Date | null; href: string }

/** What the member should know about in the next 45 days: deadlines, conference dates, predicted openings, who-you-met prompts. */
export async function upcomingConferenceItems(candidateId: string, now = new Date(), horizonDays = 45): Promise<PlanItem[]> {
  const today = startOfDay(now)
  const horizon = new Date(today.getTime() + horizonDays * DAY)
  const ucs = await prisma.userConference.findMany({ where: { candidateId, status: { not: 'SKIPPED' } }, select: { seriesId: true, status: true, id: true, contactsMet: { select: { id: true } } } })
  if (ucs.length === 0) return []
  const ids = ucs.map((u) => u.seriesId)
  const [series, opps, tracks, history] = await Promise.all([
    prisma.conferenceEvent.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, startDate: true, endDate: true, datesConfirmed: true } }),
    prisma.conferenceOpportunity.findMany({ where: { seriesId: { in: ids }, published: true, deadline: { gte: today, lte: horizon } }, select: { id: true, seriesId: true, type: true, title: true, deadline: true } }),
    prisma.conferenceOpportunityTrack.findMany({ where: { candidateId }, select: { opportunityId: true, status: true } }),
    prisma.conferenceOpportunity.findMany({ where: { seriesId: { in: ids }, published: true }, select: { seriesId: true, type: true, opensAt: true, deadline: true } }),
  ])
  const trackBy = new Map(tracks.map((t) => [t.opportunityId, t.status]))
  const name = new Map(series.map((s) => [s.id, s.name]))
  const items: PlanItem[] = []
  for (const o of opps) {
    const st = trackBy.get(o.id)
    if (st && !['WATCHING', 'DRAFTING'].includes(st)) continue
    if (!ACTIONABLE_TYPES.includes(o.type as OpportunityType)) continue
    items.push({ id: `opp:${o.id}`, kind: 'deadline', title: `${OPPORTUNITY_LABEL[o.type as OpportunityType]} closes: ${name.get(o.seriesId)}`, subtitle: o.title, date: o.deadline, href: `/dashboard/conferences/${o.seriesId}` })
  }
  for (const s of series) {
    if (s.datesConfirmed && s.startDate && s.startDate >= today && s.startDate <= horizon) {
      items.push({ id: `conf:${s.id}`, kind: 'conference', title: s.name, subtitle: 'Conference starts', date: s.startDate, href: `/dashboard/conferences/${s.id}` })
    }
  }
  const month = now.getUTCMonth()
  for (const id of ids) {
    const w: Window[] = predictWindows(history.filter((h) => h.seriesId === id))
    for (const win of w) {
      if (!['CALL_FOR_SPEAKERS', 'CALL_FOR_SUBMISSIONS'].includes(win.type)) continue
      const rm = remindMonth(win)
      const liveSoon = opps.some((o) => o.seriesId === id && o.type === win.type)
      if (rm === month && !liveSoon) items.push({ id: `opens:${id}:${win.type}`, kind: 'opens_soon', title: `${OPPORTUNITY_LABEL[win.type as OpportunityType]} usually open next month: ${name.get(id)}`, subtitle: 'Based on past years', date: null, href: `/dashboard/conferences/${id}` })
    }
  }
  for (const u of ucs) {
    if (u.status === 'ATTENDED' && u.contactsMet.length === 0) {
      items.push({ id: `people:${u.seriesId}`, kind: 'log_people', title: `Log who you met at ${name.get(u.seriesId)}`, subtitle: 'They go into your Contact Book with a follow-up', date: null, href: `/dashboard/conferences/${u.seriesId}#people` })
    }
  }
  return items.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity))
}

/** Counts that count as observable activity on the Dossier. */
export async function speakingEvidenceCounts(candidateId: string): Promise<{ talks: number; accepted: number }> {
  const [talks, accepted] = await Promise.all([
    prisma.conferenceTalk.count({ where: { candidateId } }),
    prisma.conferenceOpportunityTrack.count({ where: { candidateId, status: { in: ['ACCEPTED', 'DELIVERED'] } } }),
  ])
  return { talks, accepted }
}
