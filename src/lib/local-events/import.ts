import 'server-only'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { placeKey, countyKey } from '@/lib/workforce/places'
import { classifyKind, isNoise, proScore, trackOf, PUBLISH_MIN_SCORE, type LocalEventKind } from './classify'

export interface IncomingSource { id: string; kind: string; name: string; state: string; city?: string | null; county?: string | null; website: string; eventsUrl?: string | null; feedType?: string | null; eventCount?: number; note?: string | null }
export interface IncomingEvent {
  title: string; description?: string | null; startsAt: string; endsAt?: string | null; format?: string; venue?: string | null; city?: string | null; state?: string | null; county?: string | null
  url?: string | null; registerUrl?: string | null; cost?: string | null; sourceType: string; sourceUrl?: string | null
  /** LocalEventSource ids of the hosting org(s). */
  hostIds?: string[]
  /** Other orgs tied to it, by kind and id (a job center that co-hosts a chamber's fair). */
  partners?: { kind: string; id: string; name: string }[]
  /** Companies named as sponsors or hiring employers. Linked only on an exact normalized-name match. */
  sponsors?: string[]
  employers?: string[]
}

const FORMATS = ['IN_PERSON', 'VIRTUAL', 'HYBRID']
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' }
export const decodeEntities = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m }
  return ENTITIES[e.toLowerCase()] ?? m
})
const clip = (s: string | null | undefined, n: number) => (s ? decodeEntities(s).replace(/\s+/g, ' ').trim().slice(0, n) || null : null)

export function dedupeKeyOf(hostKey: string, title: string, startsAt: Date): string {
  const day = startsAt.toISOString().slice(0, 10)
  return createHash('sha1').update(`${hostKey}|${normalizeOrgName(title)}|${day}`).digest('hex').slice(0, 24)
}

export async function importLocalEvents(sources: IncomingSource[], events: IncomingEvent[]) {
  const now = new Date()
  for (const s of sources) {
    const data = { kind: s.kind, name: s.name, state: s.state, city: s.city ?? null, countyKey: s.county ? countyKey(s.county) : null, website: s.website, eventsUrl: s.eventsUrl ?? null, feedType: s.feedType ?? null, eventCount: s.eventCount ?? 0, note: clip(s.note, 300), checkedAt: now }
    await prisma.localEventSource.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data })
  }
  const srcIds = [...new Set(events.flatMap((e) => e.hostIds ?? []))]
  const srcRows = await prisma.localEventSource.findMany({ where: { id: { in: srcIds } } })
  const src = new Map(srcRows.map((r) => [r.id, r]))
  const centersByBoard = new Map<string, { id: string; name: string }[]>()
  const stats = { received: events.length, created: 0, updated: 0, skipped: 0, lowScore: 0 }
  for (const e of events) {
    const startsAt = new Date(e.startsAt)
    const title = clip(e.title, 200)
    if (!title || isNoise(title) || Number.isNaN(startsAt.getTime()) || startsAt.getTime() < now.getTime() - 86_400_000) { stats.skipped++; continue }
    const hosts = (e.hostIds ?? []).map((id) => src.get(id)).filter((x): x is NonNullable<typeof x> => !!x)
    const text = `${title} ${e.description ?? ''}`
    const kind: LocalEventKind = classifyKind(title, e.description ?? '')
    const score = proScore(text, kind)
    const rawState = (e.state ?? hosts[0]?.state ?? null)?.toUpperCase().slice(0, 2) || null
    const state = rawState === 'US' ? null : rawState // 'US' marks an online source with no home state
    const city = clip(e.city ?? hosts[0]?.city, 80)
    const format = FORMATS.includes(e.format ?? '') ? e.format! : 'IN_PERSON'
    const published = score >= PUBLISH_MIN_SCORE && kind !== 'OTHER' && (!!state || format === 'VIRTUAL')
    if (!published) stats.lowScore++
    const key = dedupeKeyOf(hosts[0]?.id ?? e.sourceUrl ?? title, title, startsAt)
    const data = {
      title, description: clip(e.description, 1500), kind, track: trackOf(kind), format,
      startsAt, endsAt: e.endsAt ? new Date(e.endsAt) : null, venue: clip(e.venue, 160), city, state,
      cityKey: city ? placeKey(city) : null, countyKey: e.county ? countyKey(e.county) : hosts[0]?.countyKey ?? null,
      url: clip(e.url, 500), registerUrl: clip(e.registerUrl, 500), cost: clip(e.cost, 80), proScore: score, published,
      sourceType: e.sourceType, sourceUrl: clip(e.sourceUrl, 500), lastSeenAt: now,
    }
    const existing = await prisma.localEvent.findUnique({ where: { dedupeKey: key }, select: { id: true, locked: true } })
    // A row that is not published and was never stored is not worth keeping: most crawled calendars are parks and civic events.
    if (!published && !existing) continue
    let id: string
    if (existing) {
      id = existing.id
      if (!existing.locked) await prisma.localEvent.update({ where: { id }, data })
      stats.updated++
    } else {
      id = (await prisma.localEvent.create({ data: { dedupeKey: key, ...data }, select: { id: true } })).id
      stats.created++
    }
    // Links: hosts, partners, then companies (exact match only; an unmatched sponsor is not linked).
    const links = new Map<string, { targetKind: string; targetId: string; targetName: string; role: string }>()
    const add = (targetKind: string, targetId: string, targetName: string, role: string) => links.set(`${targetKind}|${targetId}|${role}`, { targetKind, targetId, targetName, role })
    // Source ids are "<KIND>:<org id>"; the link keeps the org's own id so it matches the org's page.
    for (const h of hosts) add(h.kind, h.id.slice(h.kind.length + 1), h.name, 'HOST')
    // A board's events also belong on the pages of the job centers it runs.
    for (const h of hosts.filter((x) => x.kind === 'WORKFORCE_BOARD')) {
      const bid = h.id.slice('WORKFORCE_BOARD:'.length)
      let centers = centersByBoard.get(bid)
      if (!centers) {
        centers = await prisma.americanJobCenter.findMany({ where: { workforceBoardId: bid }, select: { id: true, name: true } })
        centersByBoard.set(bid, centers)
      }
      for (const c of centers) add('JOB_CENTER', c.id, c.name, 'PARTNER')
    }
    for (const p of e.partners ?? []) add(p.kind, p.id, p.name, 'PARTNER')
    const names = [...(e.sponsors ?? []).map((n) => [n, 'SPONSOR'] as const), ...(e.employers ?? []).map((n) => [n, 'EMPLOYER'] as const)].slice(0, 40)
    if (names.length) {
      const keys = names.map(([n]) => normalizeOrgName(n)).filter(Boolean)
      const cos = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: keys } }, select: { id: true, name: true, canonicalNameNormalized: true } })
      const by = new Map(cos.map((c) => [c.canonicalNameNormalized, c]))
      for (const [n, role] of names) { const c = by.get(normalizeOrgName(n)); if (c) add('COMPANY', c.id, c.name, role) }
    }
    await prisma.localEventLink.deleteMany({ where: { eventId: id } })
    if (links.size) await prisma.localEventLink.createMany({ data: [...links.values()].map((l) => ({ eventId: id, ...l })), skipDuplicates: true })
  }
  return stats
}
