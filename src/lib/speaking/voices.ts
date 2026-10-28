import 'server-only'
import { prisma } from '@/lib/prisma'
import { leadRef } from './sync'
import { isKind, type SpeakingKind } from './kinds'

export const APPEARANCE_ROLES = ['KEYNOTE', 'PANEL', 'TALK', 'PODCAST', 'TESTIMONY', 'OTHER'] as const
export type AppearanceRole = (typeof APPEARANCE_ROLES)[number]

export const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

/** What the appearance is, for Justin: a keynote stays a keynote, a podcast is a guest spot, everything else is a panel. */
export function kindForRole(role: AppearanceRole): SpeakingKind {
  return role === 'KEYNOTE' ? 'KEYNOTE' : role === 'PODCAST' ? 'PODCAST_WEBINAR' : 'PANEL'
}

export interface AppearanceInput {
  speaker: string
  eventName: string
  hostName?: string
  url?: string
  eventDate?: Date
  role: AppearanceRole
  location?: string
  audience?: string
  /** The next edition, when this one has already happened. */
  next?: { title?: string; url?: string; eventDate?: Date; deadline?: Date }
}

export interface SuggestedVoiceInput { name: string; org?: string; title?: string; topics?: string; note?: string }

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const day = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return undefined
  const d = new Date(`${v.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? undefined : d
}
const link = (v: unknown): string | undefined => {
  const s = str(v, 500)
  return s && /^https?:\/\//i.test(s) ? s : undefined
}

export function parseAppearances(body: unknown): {
  appearances: AppearanceInput[]; suggested: SuggestedVoiceInput[]; checked: string[]; errors: string[]
} {
  const b = (body ?? {}) as Record<string, unknown>
  const errors: string[] = []
  const appearances: AppearanceInput[] = []
  for (const [i, r] of (Array.isArray(b.appearances) ? b.appearances : []).entries()) {
    const o = (r ?? {}) as Record<string, unknown>
    const speaker = str(o.speaker, 200)
    const eventName = str(o.eventName, 200)
    const role = APPEARANCE_ROLES.find((x) => x === o.role) ?? 'PANEL'
    if (!speaker || !eventName) { errors.push(`appearance ${i}: needs speaker and eventName`); continue }
    if (o.url && !link(o.url)) { errors.push(`appearance ${i}: url must start with http(s)`); continue }
    const n = (o.next ?? null) as Record<string, unknown> | null
    appearances.push({
      speaker, eventName, role, hostName: str(o.hostName, 200), url: link(o.url), eventDate: day(o.eventDate),
      location: str(o.location, 200), audience: str(o.audience, 300),
      next: n ? { title: str(n.title, 200), url: link(n.url), eventDate: day(n.eventDate), deadline: day(n.deadline) } : undefined,
    })
  }
  const suggested: SuggestedVoiceInput[] = []
  for (const r of Array.isArray(b.suggestedVoices) ? b.suggestedVoices : []) {
    const o = (r ?? {}) as Record<string, unknown>
    const name = str(o.name, 200)
    if (name) suggested.push({ name, org: str(o.org, 200), title: str(o.title, 200), topics: str(o.topics, 200), note: str(o.note, 500) })
  }
  const checked = (Array.isArray(b.checked) ? b.checked : []).filter((x): x is string => typeof x === 'string').map(nameKey)
  return { appearances, suggested, checked, errors }
}

const dayKey = (d?: Date) => (d ? d.toISOString().slice(0, 10) : 'nodate')

/**
 * Records where a watched voice speaks and turns the actionable ones into speaking opportunities. An upcoming
 * appearance becomes an opportunity on that event; a past one becomes an opportunity on the next edition when the
 * search found it (the same stage will be booked again). An opportunity that already exists from another source
 * keeps its place and gains a line saying who else speaks there.
 */
export async function importAppearances(
  inputs: AppearanceInput[], suggested: SuggestedVoiceInput[], checked: string[], dryRun: boolean, now = new Date(),
) {
  const voices = await prisma.speakerWatch.findMany({ where: { status: { in: ['ACTIVE', 'PAUSED'] } }, select: { id: true, nameKey: true, name: true } })
  const byKey = new Map(voices.map((v) => [v.nameKey, v]))
  const out = { appearancesNew: 0, appearancesKnown: 0, opportunitiesNew: 0, opportunitiesUpdated: 0, unknownSpeakers: [] as string[], suggestedNew: 0 }

  for (const a of inputs) {
    const v = byKey.get(nameKey(a.speaker))
    if (!v) { out.unknownSpeakers.push(a.speaker); continue }
    const sourceRef = `${v.id}:${a.url ? leadRef({ url: a.url, title: a.eventName }) : `${nameKey(a.eventName)}|${dayKey(a.eventDate)}`}`.slice(0, 300)
    if (await prisma.speakerAppearance.findUnique({ where: { sourceRef }, select: { id: true } })) { out.appearancesKnown++; continue }

    const upcoming = !!a.eventDate && a.eventDate >= now
    const target = upcoming || !a.eventDate
      ? { title: a.eventName, url: a.url, eventDate: a.eventDate, deadline: undefined as Date | undefined, past: false }
      : a.next && (a.next.url || a.next.eventDate)
        ? { title: a.next.title ?? `${a.eventName} (next edition)`, url: a.next.url ?? a.url, eventDate: a.next.eventDate, deadline: a.next.deadline, past: true }
        : null
    let opportunityId: string | null = null
    if (target && !dryRun) {
      const ref = leadRef({ url: target.url, title: target.title, hostName: a.hostName })
      const line = `${v.name} ${target.past ? 'spoke at the last edition' : 'is speaking here'}${a.role === 'KEYNOTE' ? ' (keynote)' : ''}.`
      const existing = await prisma.ceoSpeakingOpportunity.findUnique({ where: { sourceRef: ref }, select: { id: true, why: true, status: true } })
      if (existing) {
        opportunityId = existing.id
        if (!(existing.why ?? '').includes(v.name)) {
          await prisma.ceoSpeakingOpportunity.update({ where: { id: existing.id }, data: { why: `${existing.why ? `${existing.why} ` : ''}${line}`.slice(0, 600), fit: 1 } })
          out.opportunitiesUpdated++
        }
      } else {
        const created = await prisma.ceoSpeakingOpportunity.create({
          data: {
            kind: kindForRole(a.role), title: target.title, hostName: a.hostName, url: target.url, eventDate: target.eventDate,
            deadline: target.deadline, location: a.location, audience: a.audience, why: `${line} Where leaders in your field speak.`,
            fit: 1, source: 'DISCOVERY', sourceRef: ref,
          },
          select: { id: true },
        })
        opportunityId = created.id
        out.opportunitiesNew++
      }
    }
    if (!dryRun) {
      await prisma.speakerAppearance.create({
        data: { speakerId: v.id, eventName: a.eventName, hostName: a.hostName, url: a.url, eventDate: a.eventDate, role: a.role, location: a.location, sourceRef, opportunityId },
      })
    }
    out.appearancesNew++
  }

  if (!dryRun) {
    for (const s of suggested) {
      const key = nameKey(s.name)
      if (byKey.has(key) || (await prisma.speakerWatch.findUnique({ where: { nameKey: key }, select: { id: true } }))) continue
      await prisma.speakerWatch.create({ data: { name: s.name.trim(), nameKey: key, org: s.org, title: s.title, topics: s.topics, note: s.note, status: 'SUGGESTED', source: 'DISCOVERY' } })
      out.suggestedNew++
    }
    const keys = checked.filter((k) => byKey.has(k))
    if (keys.length) await prisma.speakerWatch.updateMany({ where: { nameKey: { in: keys } }, data: { lastCheckedAt: now } })
  }
  return out
}

export { isKind }
