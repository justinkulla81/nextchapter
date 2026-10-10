import 'server-only'
import { prisma } from '@/lib/prisma'
import { repostKey } from '@/lib/jobs/ghost-risk'

// How many times each company + title + location has been posted and closed. One query over
// the closed postings (thousands, not tens of thousands), memoised for a few
// minutes because every board render needs it.
const TTL_MS = 5 * 60 * 1000
let cache: { at: number; counts: Promise<Map<string, number>> } | null = null

async function load(): Promise<Map<string, number>> {
  const rows = await prisma.exclusiveJobPosting.groupBy({
    by: ['companyName', 'title', 'location'],
    where: { archivedAt: { not: null } },
    _count: { _all: true },
  })
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(repostKey(r.companyName, r.title, r.location), r._count._all)
  return counts
}

export function getClosedPostingCounts(): Promise<Map<string, number>> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const counts = load()
    cache = { at: Date.now(), counts }
    counts.catch(() => {
      if (cache?.counts === counts) cache = null
    })
  }
  return cache.counts
}
