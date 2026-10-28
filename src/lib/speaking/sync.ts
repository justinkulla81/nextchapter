import 'server-only'
import { prisma } from '@/lib/prisma'
import { kindFromConferenceType, isKind, OPEN_STATUSES, type SpeakingKind } from './kinds'
import { speakerFit } from './relevance'

const DAY = 86_400_000
/** How far ahead a deadline becomes a to-do. Later ones sit on the speaking page until they get close. */
export const TODO_WINDOW_DAYS = 45
const MAX_NEW_PER_RUN = 40

function place(city: string | null, state: string | null): string | null {
  const s = [city, state].filter(Boolean).join(', ')
  return s || null
}

/**
 * Pulls speaking spots that fit the CEO out of the conference catalog: open
 * calls for speakers, demo and presentation slots, and flagship events that
 * take speakers by invitation (shown as "pitch yourself"). New rows only; a row
 * Justin has already touched is never rewritten, but a New one follows the
 * catalog if the deadline or link moves.
 */
export async function syncFromConferences(now = new Date()): Promise<{ created: number; updated: number }> {
  const [opps, events] = await Promise.all([
    prisma.conferenceOpportunity.findMany({
      where: {
        published: true,
        type: { in: ['CALL_FOR_SPEAKERS', 'CALL_FOR_SUBMISSIONS', 'PRESENTATION', 'DEMO', 'CONTEST', 'AWARD'] },
        OR: [{ deadline: { gte: now } }, { deadline: null }],
        series: { published: true },
      },
      include: { series: true, edition: true },
      take: 600,
    }),
    prisma.conferenceEvent.findMany({
      where: {
        published: true,
        speaking: { in: ['OPEN_CFP', 'BY_INVITE', 'UNKNOWN'] },
        OR: [{ startDate: { gte: now } }, { speakingDeadline: { gte: now } }],
        importance: { lte: 2 },
      },
      take: 1500,
    }),
  ])

  type Row = {
    sourceRef: string; kind: SpeakingKind; title: string; hostName: string | null; url: string | null
    eventDate: Date | null; deadline: Date | null; location: string | null; audience: string | null; why: string; fit: number
  }
  const rows: Row[] = []

  for (const o of opps) {
    const kind = kindFromConferenceType(o.type)
    const s = o.series
    const fit = speakerFit(s)
    if (!kind || !fit) continue
    rows.push({
      sourceRef: `conf:opp:${o.id}`, kind, title: `${o.title} · ${s.name}`, hostName: s.organizer, url: o.url ?? s.url,
      eventDate: o.edition?.startDate ?? s.startDate, deadline: o.deadline, location: place(s.city, s.state),
      audience: s.industries.slice(0, 3).join(', ') || null, why: `${fit.why}${o.eligibility ? ` Eligibility: ${o.eligibility}` : ''}`, fit: fit.fit,
    })
  }

  const covered = new Set(opps.map((o) => o.seriesId))
  for (const e of events) {
    if (covered.has(e.id)) continue
    const fit = speakerFit(e)
    if (!fit) continue
    const open = e.speaking === 'OPEN_CFP'
    // Invitation-only and unknown programs are worth a pitch only when they are a flagship fit with a stage to speak on.
    if (!open && !(fit.fit === 1 && e.programFormats.some((f) => f === 'KEYNOTE' || f === 'PANEL'))) continue
    rows.push({
      sourceRef: `conf:event:${e.id}:${(e.startDate ?? e.speakingDeadline ?? now).getUTCFullYear()}`,
      kind: e.programFormats.includes('KEYNOTE') && !open ? 'KEYNOTE' : 'PANEL',
      title: open ? `Call for speakers · ${e.name}` : `Pitch yourself as a speaker · ${e.name}`,
      hostName: e.organizer, url: e.speakingUrl ?? e.url, eventDate: e.startDate, deadline: open ? e.speakingDeadline : null,
      location: place(e.city, e.state), audience: e.industries.slice(0, 3).join(', ') || null,
      why: `${fit.why}${e.speakingNote ? ` ${e.speakingNote}` : ''}`, fit: fit.fit,
    })
  }

  const existing = await prisma.ceoSpeakingOpportunity.findMany({
    where: { sourceRef: { in: rows.map((r) => r.sourceRef) } },
    select: { id: true, sourceRef: true, status: true, deadline: true, url: true },
  })
  const have = new Map(existing.map((x) => [x.sourceRef, x]))
  let created = 0
  let updated = 0
  for (const r of rows) {
    const cur = have.get(r.sourceRef)
    if (!cur) {
      if (created >= MAX_NEW_PER_RUN) continue
      await prisma.ceoSpeakingOpportunity.create({ data: { ...r, source: 'CONFERENCE' } })
      created++
    } else if (cur.status === 'NEW' && (cur.deadline?.getTime() !== r.deadline?.getTime() || cur.url !== r.url)) {
      await prisma.ceoSpeakingOpportunity.update({ where: { id: cur.id }, data: { deadline: r.deadline, url: r.url, eventDate: r.eventDate } })
      updated++
    }
  }
  return { created, updated }
}

function dueFor(deadline: Date | null, now: Date): Date {
  // Seven days before the deadline, never in the past, 9:00 ET like the other to-dos.
  const base = deadline ? new Date(deadline.getTime() - 7 * DAY) : new Date(now.getTime() + 7 * DAY)
  const t = base.getTime() < now.getTime() + DAY ? now.getTime() + DAY : base.getTime()
  const d = new Date(t)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 0, 0))
}

/**
 * Keeps one to-do per open opportunity. New + close deadline (or a top fit) =
 * "Decide"; Going for it = "Apply"; any later stage closes it. Idempotent: the
 * task id is stored on the row, so running it twice never doubles up.
 */
export async function syncSpeakingTasks(now = new Date()): Promise<{ opened: number; closed: number }> {
  const horizon = new Date(now.getTime() + TODO_WINDOW_DAYS * DAY)
  const rows = await prisma.ceoSpeakingOpportunity.findMany({
    where: { OR: [{ status: { in: OPEN_STATUSES } }, { taskId: { not: null } }] },
  })
  let opened = 0
  let closed = 0
  for (const r of rows) {
    const open = OPEN_STATUSES.includes(r.status as never)
    const expired = !!r.deadline && r.deadline < now
    const wanted = open && !expired && (r.status === 'PLANNING' || (r.deadline ? r.deadline <= horizon : r.fit === 1))
    const verb = r.status === 'PLANNING' ? 'Apply' : 'Decide on'
    const title = `Speaking: ${verb} ${r.title}`.slice(0, 300)
    if (wanted) {
      const notes = [r.why, r.url, r.deadline ? `Deadline ${r.deadline.toISOString().slice(0, 10)}` : null].filter(Boolean).join('\n')
      if (r.taskId) {
        const t = await prisma.crmTask.findUnique({ where: { id: r.taskId }, select: { status: true, title: true } })
        if (t && t.status === 'OPEN' && t.title !== title) await prisma.crmTask.update({ where: { id: r.taskId }, data: { title } })
        // A to-do Justin marked done stays done; the row's own buttons move the stage.
        if (t) continue
      }
      const task = await prisma.crmTask.create({
        data: { title, notes, kind: 'PREPARE', area: 'speaking', dueAt: dueFor(r.deadline, now), ownerEmail: null },
      })
      await prisma.ceoSpeakingOpportunity.update({ where: { id: r.id }, data: { taskId: task.id } })
      opened++
    } else if (r.taskId) {
      const res = await prisma.crmTask.updateMany({ where: { id: r.taskId, status: 'OPEN' }, data: { status: 'DONE', completedAt: now } })
      closed += res.count
      if (!open) await prisma.ceoSpeakingOpportunity.update({ where: { id: r.id }, data: { taskId: null } })
    }
  }
  return { opened, closed }
}

export interface SpeakingLeadInput {
  kind: SpeakingKind
  title: string
  hostName?: string
  url?: string
  eventDate?: Date
  deadline?: Date
  location?: string
  audience?: string
  why?: string
  fit: number
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
const date = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return undefined
  const d = new Date(`${v.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function parseSpeakingLeads(body: unknown): { leads: SpeakingLeadInput[]; errors: string[] } {
  const raw = (body as { leads?: unknown })?.leads
  if (!Array.isArray(raw)) return { leads: [], errors: ['Body must be { leads: [...] }'] }
  const leads: SpeakingLeadInput[] = []
  const errors: string[] = []
  raw.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>
    const title = str(o.title, 200)
    const url = str(o.url, 500)
    if (!title || !isKind(o.kind)) return void errors.push(`lead ${i}: needs a title and a valid kind`)
    if (url && !/^https?:\/\//i.test(url)) return void errors.push(`lead ${i}: url must start with http(s)`)
    const fit = Number(o.fit)
    leads.push({
      kind: o.kind, title, url, hostName: str(o.hostName, 200), eventDate: date(o.eventDate), deadline: date(o.deadline),
      location: str(o.location, 200), audience: str(o.audience, 300), why: str(o.why, 600),
      fit: fit === 1 || fit === 3 ? fit : 2,
    })
  })
  return { leads, errors }
}

/** Stable key for a posted lead: the link without tracking noise, else host + title. */
export function leadRef(l: Pick<SpeakingLeadInput, 'url' | 'title' | 'hostName'>): string {
  if (l.url) {
    try {
      const u = new URL(l.url)
      return `web:${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '').toLowerCase()}`
    } catch { /* fall through */ }
  }
  return `web:${(l.hostName ?? '').toLowerCase()}|${l.title.toLowerCase()}`.slice(0, 300)
}

export async function importSpeakingLeads(leads: SpeakingLeadInput[], dryRun: boolean) {
  const refs = leads.map(leadRef)
  const have = new Set(
    (await prisma.ceoSpeakingOpportunity.findMany({ where: { sourceRef: { in: refs } }, select: { sourceRef: true } })).map((x) => x.sourceRef),
  )
  const results: { title: string; alreadyLogged: boolean }[] = []
  const seenInBatch = new Set<string>()
  for (const [i, l] of leads.entries()) {
    const sourceRef = refs[i]
    if (have.has(sourceRef)) {
      // A row nobody has acted on follows the search: a moved deadline, new dates or a new link replace the old ones.
      if (!dryRun && !seenInBatch.has(sourceRef)) {
        const cur = await prisma.ceoSpeakingOpportunity.findUnique({ where: { sourceRef }, select: { id: true, status: true, deadline: true, eventDate: true } })
        if (cur && cur.status === 'NEW' && ((l.deadline && l.deadline.getTime() !== cur.deadline?.getTime()) || (l.eventDate && l.eventDate.getTime() !== cur.eventDate?.getTime()))) {
          await prisma.ceoSpeakingOpportunity.update({ where: { id: cur.id }, data: { deadline: l.deadline ?? cur.deadline, eventDate: l.eventDate ?? cur.eventDate } })
        }
      }
      results.push({ title: l.title, alreadyLogged: true }); continue
    }
    seenInBatch.add(sourceRef)
    have.add(sourceRef)
    if (!dryRun) await prisma.ceoSpeakingOpportunity.create({ data: { ...l, sourceRef, source: 'DISCOVERY' } })
    results.push({ title: l.title, alreadyLogged: false })
  }
  return results
}
