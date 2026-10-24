import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeContactKey } from '@/lib/network/csv-import'
import { EVIDENCE_TRACK_STATUSES, TRACK_STATUSES, USER_STATUSES, type TalkKind, type TrackStatus, type UserStatus } from './constants'

/** Latest non-cancelled edition of a series, the one a member plans around. */
async function currentEditionId(seriesId: string): Promise<string | null> {
  const e = await prisma.conferenceEdition.findFirst({ where: { seriesId, status: { in: ['TBA', 'CONFIRMED'] } }, orderBy: { year: 'desc' }, select: { id: true } })
  return e?.id ?? null
}

/** Set (or with onlyIfNew, only create) the member's status on a series. Private to the member. */
export async function setUserStatus(candidateId: string, seriesId: string, status: UserStatus, opts: { onlyIfNew?: boolean; editionId?: string | null } = {}) {
  if (!USER_STATUSES.includes(status)) return null
  const editionId = opts.editionId ?? (await currentEditionId(seriesId))
  const where = { candidateId_seriesId: { candidateId, seriesId } }
  const before = await prisma.userConference.findUnique({ where, select: { status: true } })
  if (opts.onlyIfNew && before) return before
  const row = await prisma.userConference.upsert({ where, create: { candidateId, seriesId, editionId, status }, update: { status, ...(editionId ? { editionId } : {}) } })
  if (before?.status !== status) captureServerEvent(candidateId, 'user_conference_status_set', { seriesId, status, previous: before?.status ?? null })
  return row
}

export async function clearUserStatus(candidateId: string, seriesId: string) {
  await prisma.userConference.deleteMany({ where: { candidateId, seriesId } })
  captureServerEvent(candidateId, 'user_conference_cleared', { seriesId })
}

export async function saveNotes(candidateId: string, seriesId: string, notes: string | null, goals: string | null) {
  await prisma.userConference.updateMany({ where: { candidateId, seriesId }, data: { notes: notes?.slice(0, 4000) || null, goals: goals?.slice(0, 2000) || null } })
}

const TALK_KIND_FOR: Record<string, TalkKind> = { CALL_FOR_SPEAKERS: 'TALK', PRESENTATION: 'TALK', CALL_FOR_SUBMISSIONS: 'SUBMISSION_ACCEPTED', AWARD: 'AWARD', CONTEST: 'AWARD', DEMO: 'DEMO', REPORT: 'TALK' }

/** Move a member's stage on an opportunity. Accepted and Delivered also write a speaking-history row, which feeds the Dossier. */
export async function setTrackStatus(candidateId: string, opportunityId: string, status: TrackStatus | 'NONE') {
  if (status === 'NONE') {
    await prisma.conferenceOpportunityTrack.deleteMany({ where: { candidateId, opportunityId } })
    return
  }
  if (!TRACK_STATUSES.includes(status)) return
  const opp = await prisma.conferenceOpportunity.findFirst({ where: { id: opportunityId, published: true }, include: { series: { select: { id: true, name: true } } } })
  if (!opp) return
  const before = await prisma.conferenceOpportunityTrack.findUnique({ where: { candidateId_opportunityId: { candidateId, opportunityId } }, select: { status: true } })
  await prisma.conferenceOpportunityTrack.upsert({
    where: { candidateId_opportunityId: { candidateId, opportunityId } },
    create: { candidateId, opportunityId, status }, update: { status },
  })
  if (EVIDENCE_TRACK_STATUSES.includes(status)) {
    const has = await prisma.conferenceTalk.findFirst({ where: { candidateId, opportunityId }, select: { id: true } })
    if (!has) {
      await prisma.conferenceTalk.create({
        data: { candidateId, opportunityId, seriesId: opp.seriesId, kind: TALK_KIND_FOR[opp.type] ?? 'TALK', title: opp.title, eventName: opp.series.name },
      })
    }
  }
  captureServerEvent(candidateId, 'conference_opportunity_status_set', { opportunityId, seriesId: opp.seriesId, type: opp.type, status, previous: before?.status ?? null })
  // Working on an opportunity means following the series.
  await setUserStatus(candidateId, opp.seriesId, 'TRACKING', { onlyIfNew: true })
}

export interface TalkInput { title: string; eventName?: string | null; topic?: string | null; deliveredOn?: string | null; slidesUrl?: string | null; videoUrl?: string | null; kind?: TalkKind; seriesId?: string | null }
const link = (v: string | null | undefined) => (v && /^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 600) : null)

export async function addTalk(candidateId: string, t: TalkInput) {
  const title = t.title.trim().slice(0, 200)
  if (!title) return null
  const row = await prisma.conferenceTalk.create({
    data: {
      candidateId, title, kind: t.kind ?? 'TALK', seriesId: t.seriesId ?? null, eventName: t.eventName?.trim().slice(0, 160) || null, topic: t.topic?.trim().slice(0, 160) || null,
      deliveredOn: t.deliveredOn && /^\d{4}-\d{2}-\d{2}$/.test(t.deliveredOn) ? new Date(`${t.deliveredOn}T00:00:00Z`) : null,
      slidesUrl: link(t.slidesUrl), videoUrl: link(t.videoUrl),
    },
  })
  captureServerEvent(candidateId, 'conference_talk_added', { talkId: row.id, kind: row.kind, hasSlides: !!row.slidesUrl, hasVideo: !!row.videoUrl })
  return row
}

export interface MetPerson { name: string; company?: string | null; title?: string | null; note?: string | null }

/** "Log who you met": each person becomes a Contact Book entry (reusing one with the same name and company) linked to the conference. */
export async function logPeopleMet(candidateId: string, seriesId: string, people: MetPerson[]): Promise<number> {
  const uc = await prisma.userConference.findUnique({ where: { candidateId_seriesId: { candidateId, seriesId } }, select: { id: true } })
  const series = await prisma.conferenceEvent.findUnique({ where: { id: seriesId }, select: { name: true } })
  if (!uc || !series) return 0
  let added = 0
  for (const p of people.slice(0, 20)) {
    const name = p.name.trim().slice(0, 120)
    if (!name) continue
    const company = p.company?.trim().slice(0, 120) || null
    const key = normalizeContactKey(name, company)
    const existing = await prisma.supportNetworkContact.findFirst({ where: { candidateId, normalizedKey: key, removedAt: null }, select: { id: true } })
    const contactId = existing?.id ?? (await prisma.supportNetworkContact.create({
      data: { candidateId, name, company, title: p.title?.trim().slice(0, 120) || null, normalizedKey: key, source: 'MANUAL' },
      select: { id: true },
    })).id
    const note = [p.note?.trim(), `Met at ${series.name}`].filter(Boolean).join('. ').slice(0, 400)
    await prisma.conferenceContactMet.upsert({
      where: { userConferenceId_contactId: { userConferenceId: uc.id, contactId } },
      create: { userConferenceId: uc.id, contactId, note }, update: { note },
    })
    added++
  }
  if (added > 0) captureServerEvent(candidateId, 'conference_people_logged', { seriesId, count: added })
  return added
}
