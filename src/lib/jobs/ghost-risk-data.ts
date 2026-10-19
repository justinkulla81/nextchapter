import 'server-only'
import { prisma } from '@/lib/prisma'
import { LIKELY_AGE_DAYS, repostKey, STILL_LISTED_DAYS } from '@/lib/jobs/ghost-risk'
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

// Direct employer listings recently confirmed still listed (ghost-risk.ts stillListedDirect),
// id -> lastVerifiedAt (ms). Only rows old enough for age to matter (past 90 days, less a
// day of slack so a held board's rows that age past 90 before the next load are covered)
// — an index scan on (archivedAt, createdAt), a few ms. Neither column is on
// BoardLightRow, so the board looks them up here, memoised like the closure counts.
// Unreadable = empty map: age rules for every listing as before (the stricter side).
let listedCache: { at: number; ids: Promise<Map<string, number>> } | null = null

async function loadStillListed(): Promise<Map<string, number>> {
  const now = Date.now()
  const ids = new Map<string, number>()
  try {
    const rows = await prisma.exclusiveJobPosting.findMany({
      where: {
        archivedAt: null,
        status: 'approved',
        directListing: true,
        createdAt: { lt: new Date(now - (LIKELY_AGE_DAYS - 1) * 86_400_000) },
        lastVerifiedAt: { gte: new Date(now - STILL_LISTED_DAYS * 86_400_000) },
      },
      select: { id: true, lastVerifiedAt: true },
    })
    for (const r of rows) if (r.lastVerifiedAt) ids.set(r.id, r.lastVerifiedAt.getTime())
  } catch (error) {
    console.error('ghost risk: could not read still-listed direct listings', error)
  }
  return ids
}

/** Direct listings confirmed still listed, id -> lastVerifiedAt ms (pass to stillListedDirect with true). */
export function getStillListedDirect(): Promise<Map<string, number>> {
  if (!listedCache || Date.now() - listedCache.at > TTL_MS) listedCache = { at: Date.now(), ids: loadStillListed() }
  return listedCache.ids
}
