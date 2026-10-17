import 'server-only'
import { prisma } from '@/lib/prisma'
import { repostKey } from '@/lib/jobs/ghost-risk'
import { groupClosedPostings } from '@/lib/jobs/board-light-rows'

// How many times each company + title + location has been posted and closed. One query over
// the closed postings (thousands, not tens of thousands), memoised for a few
// minutes because every board render needs it.
const TTL_MS = 5 * 60 * 1000
let cache: { at: number; counts: Promise<Map<string, number>> } | null = null

async function load(): Promise<Map<string, number>> {
  // From the narrow BoardLightRow copy when it's there (board-light-rows.ts) — the
  // same rows; the wide table took ~7 s to group.
  const rows = await groupClosedPostings()
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(repostKey(r.companyName, r.title, r.location), r.count)
  // A collapsed second copy of a live role (closeReason 'duplicate', job-status.ts) is
  // archived but never closed: it must not count as the role closing before.
  try {
    const dups = await prisma.exclusiveJobPosting.groupBy({
      by: ['companyName', 'title', 'location'],
      where: { closeReason: 'duplicate' },
      _count: { _all: true },
    })
    for (const d of dups) {
      const key = repostKey(d.companyName, d.title, d.location)
      const left = (counts.get(key) ?? 0) - d._count._all
      if (left > 0) counts.set(key, left)
      else counts.delete(key)
    }
  } catch (error) {
    console.error('ghost risk: could not read collapsed duplicates', error)
  }
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
