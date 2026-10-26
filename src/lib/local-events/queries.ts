import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export interface LocalEventRow {
  id: string; title: string; kind: string; track: string; format: string; startsAt: Date; endsAt: Date | null
  venue: string | null; city: string | null; state: string | null; url: string | null; registerUrl: string | null; cost: string | null
  hosts: { kind: string; id: string; name: string; role: string }[]
}

export type LocalEventScope = { online?: boolean; state?: string; cityKey?: string; countyKey?: string; link?: { kind: string; id: string }; track?: 'JOBS' | 'ENTREPRENEUR' }

const whereOf = (s: LocalEventScope) => ({
  ...(s.online ? { format: 'VIRTUAL', state: null } : {}),
  ...(s.state ? { state: s.state } : {}), ...(s.cityKey ? { cityKey: s.cityKey } : {}), ...(s.countyKey ? { countyKey: s.countyKey } : {}),
  ...(s.track ? { track: s.track } : {}), ...(s.link ? { links: { some: { targetKind: s.link.kind, targetId: s.link.id } } } : {}),
})

async function load(scope: LocalEventScope, take: number): Promise<LocalEventRow[]> {
  const rows = await prisma.localEvent.findMany({
    where: { published: true, startsAt: { gte: new Date(Date.now() - 86_400_000) }, ...whereOf(scope) },
    orderBy: { startsAt: 'asc' }, take,
    select: {
      id: true, title: true, kind: true, track: true, format: true, startsAt: true, endsAt: true, venue: true, city: true, state: true, url: true, registerUrl: true, cost: true,
      links: { select: { targetKind: true, targetId: true, targetName: true, role: true } },
    },
  })
  return rows.map(({ links, ...r }) => ({ ...r, hosts: links.map((l) => ({ kind: l.targetKind, id: l.targetId, name: l.targetName, role: l.role })) }))
}

const cached = unstable_cache(async (scopeJson: string, take: number) => {
  try { return await load(JSON.parse(scopeJson), take) } catch { return [] as LocalEventRow[] }
}, ['local-events-for'], { revalidate: 3600 })

/** Upcoming local events for a place or an org. Cached an hour; a failed read returns []. */
export async function localEvents(scope: LocalEventScope, take = 12): Promise<LocalEventRow[]> {
  // unstable_cache stores JSON, so dates come back as strings.
  return (await cached(JSON.stringify(scope), take)).map((r) => ({ ...r, startsAt: new Date(r.startsAt), endsAt: r.endsAt ? new Date(r.endsAt) : null }))
}

/** A state hub page is offered to search engines once it lists at least this many upcoming events. */
export const EVENTS_STATE_MIN = 8

const countsCached = unstable_cache(async (): Promise<Record<string, number>> => {
  try {
    const rows = await prisma.localEvent.groupBy({ by: ['state'], where: { published: true, state: { not: null }, startsAt: { gte: new Date(Date.now() - 86_400_000) } }, _count: { _all: true } })
    return Object.fromEntries(rows.filter((r) => r.state).map((r) => [r.state!, r._count._all]))
  } catch { return {} }
}, ['local-event-state-counts'], { revalidate: 3600 })

/** Upcoming published events per state code. */
export const eventStateCounts = () => countsCached()
