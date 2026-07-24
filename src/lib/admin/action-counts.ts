import 'server-only'
import type { CurrentJobStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface ActionCountRow {
  event: string
  count: number
}

export interface ActionCountsFilters {
  from?: Date
  segment?: CurrentJobStatus
  q?: string
}

// Server-tracked actions only — mirrors src/lib/posthog/server.ts's
// captureServerEvent, the one confirmed single choke point. Client-side
// posthog.capture() call sites (6 scattered files) aren't mirrored yet.
export async function getActionCounts(filters: ActionCountsFilters): Promise<{ total: number; rows: ActionCountRow[] }> {
  let distinctIds: string[] | undefined
  if (filters.segment) {
    const candidates = await prisma.candidateProfile.findMany({
      where: { currentJobStatus: filters.segment },
      select: { id: true },
    })
    distinctIds = candidates.map((c) => c.id)
  }

  const events = await prisma.analyticsEvent.findMany({
    where: {
      ...(filters.from && { createdAt: { gte: filters.from } }),
      ...(distinctIds && { distinctId: { in: distinctIds } }),
    },
    select: { event: true },
  })

  const counts = new Map<string, number>()
  for (const e of events) counts.set(e.event, (counts.get(e.event) ?? 0) + 1)

  const q = filters.q?.trim().toLowerCase()
  const rows = Array.from(counts.entries())
    .map(([event, count]) => ({ event, count }))
    .filter((r) => !q || r.event.toLowerCase().includes(q))
    .sort((a, b) => b.count - a.count)

  return { total: events.length, rows }
}
