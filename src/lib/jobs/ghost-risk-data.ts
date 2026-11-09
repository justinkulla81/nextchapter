import 'server-only'
import { gunzipSync, gzipSync } from 'node:zlib'
import { prisma } from '@/lib/prisma'
import { LIKELY_AGE_DAYS, repostKey, STILL_LISTED_DAYS } from '@/lib/jobs/ghost-risk'
import { groupClosedPostings } from '@/lib/jobs/board-light-rows'

// How many times each company + title + location has been posted and closed. Grouping the closed postings (tens of thousands of
// rows) took 16-25 s on a cold server instance (measured on the job page), so the nightly job (cron closed-posting-snapshot) groups them
// once and stores the result (ClosedPostingSnapshot); a server instance reads that snapshot and holds it. Only when there is no
// snapshot yet, or it is too old (the nightly job has been failing), does an instance group the closed postings itself.
// An hour: ghost risk turns on days of age and closures, and every instance re-read ~20k rows each time this expired.
const TTL_MS = 60 * 60 * 1000
/** A snapshot older than this is not trusted: the nightly job has stopped, so the live grouping is the better answer. */
export const SNAPSHOT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const KEEP_SNAPSHOTS = 3
let cache: { at: number; counts: Promise<Map<string, number>> } | null = null

/** Groups the closed postings now (slow). The nightly job calls this; readers only do when there is no usable snapshot. */
export async function computeClosedPostingCounts(): Promise<Map<string, number>> {
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

// The map has ~520,000 keys (15 MB as JSON). Written as one object it stalled the nightly job after grouping on 2026-11-09 (the write never
// finished, and Postgres logged no statement for it), so it is stored gzipped as one string: { v: 2, gz: <base64> }, about 4 MB.
// Rows written before that are the plain object and are still read.
type PackedSnapshot = { v: 2; gz: string }
const isPacked = (data: unknown): data is PackedSnapshot => !!data && typeof data === 'object' && (data as PackedSnapshot).v === 2 && typeof (data as PackedSnapshot).gz === 'string'

export function packClosedPostingCounts(counts: Map<string, number>): PackedSnapshot {
  return { v: 2, gz: gzipSync(JSON.stringify(Object.fromEntries(counts))).toString('base64') }
}

export function unpackClosedPostingCounts(data: unknown): Map<string, number> | null {
  if (isPacked(data)) return new Map(Object.entries(JSON.parse(gunzipSync(Buffer.from(data.gz, 'base64')).toString()) as Record<string, number>))
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return new Map(Object.entries(data as Record<string, number>))
}

async function readSnapshot(): Promise<Map<string, number> | null> {
  try {
    const row = await prisma.closedPostingSnapshot.findFirst({ orderBy: { computedAt: 'desc' }, select: { computedAt: true, data: true } })
    if (!row || Date.now() - row.computedAt.getTime() > SNAPSHOT_MAX_AGE_MS) return null
    return unpackClosedPostingCounts(row.data)
  } catch (error) {
    console.error('ghost risk: closed-postings snapshot unavailable', error)
    return null
  }
}

async function loadCounts(): Promise<Map<string, number>> {
  const snapshot = await readSnapshot()
  if (snapshot) return snapshot
  console.warn('ghost risk: no usable closed-postings snapshot, grouping the closed postings here')
  return computeClosedPostingCounts()
}

export function getClosedPostingCounts(): Promise<Map<string, number>> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const counts = loadCounts()
    cache = { at: Date.now(), counts }
    counts.catch(() => {
      if (cache?.counts === counts) cache = null
    })
  }
  return cache.counts
}

/**
 * The nightly rebuild (cron closed-posting-snapshot): group once, store, keep the newest few. `onStep` hears how long each step took, so a
 * run that stalls says where (2026-11-07: the run that did this inside board-light-rows was cut off twice without a trace).
 */
export async function rebuildClosedPostingSnapshot(onStep?: (step: string, ms: number) => void | Promise<void>): Promise<{ keys: number }> {
  let at = Date.now()
  const lap = async (step: string) => {
    const now = Date.now()
    await onStep?.(step, now - at)
    at = now
  }
  const counts = await computeClosedPostingCounts()
  await lap('grouped')
  const packed = packClosedPostingCounts(counts)
  await lap('packed')
  await prisma.closedPostingSnapshot.create({ data: { data: packed } })
  await lap('stored')
  const old = await prisma.closedPostingSnapshot.findMany({ orderBy: { computedAt: 'desc' }, skip: KEEP_SNAPSHOTS, select: { id: true } })
  if (old.length) await prisma.closedPostingSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
  await lap('pruned')
  return { keys: counts.size }
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
