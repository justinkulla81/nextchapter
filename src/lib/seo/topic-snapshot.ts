import 'server-only'
import { cache } from 'react'
import { after } from 'next/server'
import { heavy } from '@/lib/db/heavy'
import { prisma } from '@/lib/prisma'
import { INDUSTRIES, JOB_FUNCTIONS } from '@/lib/seo/topics'
import type { JobFilter } from '@/lib/seo/topic-data'

// The industry and function pages show aggregates over tens of thousands of open jobs. Computing them on a page view
// held database connections for 10 to 40 seconds and, under a crawl, exhausted the pool (PR 400). They are computed
// ahead of time by the topic-snapshots cron and stored in TopicSnapshot (prisma/manual/topic-snapshot.sql); a page view
// reads one row. A topic with no snapshot yet shows without its job figures, falls under the quality bar, and returns
// by itself once the cron has stored one.

export const SNAPSHOT_MAX_AGE_MS = 23 * 3600_000

export function topicFilters(): JobFilter[] {
  return [...INDUSTRIES.filter((i) => i.rule).map((i) => ({ rule: i.rule! })), ...JOB_FUNCTIONS.map((f) => ({ fn: f.name }))]
}

/** One read per request however many loaders ask. */
const rowsByKey = cache(async () => {
  const rows = await prisma.topicSnapshot.findMany({ select: { key: true, data: true, updatedAt: true } }).catch(() => [])
  return new Map(rows.map((r) => [r.key, r]))
})

export async function readSnapshot<T>(key: string): Promise<T | null> {
  return ((await rowsByKey()).get(key)?.data as T | undefined) ?? null
}

const inFlight = new Map<string, Promise<unknown>>()

async function computeAndStore<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key)
  if (running) return running as Promise<T>
  const p = (async () => {
    const value = await heavy(compute)
    await prisma.topicSnapshot.upsert({ where: { key }, create: { key, data: value as object }, update: { data: value as object, updatedAt: new Date() } })
    return value
  })()
  inFlight.set(key, p)
  p.then(() => inFlight.delete(key), () => inFlight.delete(key))
  return p
}

function refreshInBackground<T>(key: string, compute: () => Promise<T>) {
  if (inFlight.has(key)) return
  const run = () => computeAndStore(key, compute).catch((e) => console.error('TopicSnapshot refresh failed', key, e))
  try {
    after(run)
  } catch {
    void run()
  }
}

/**
 * A heavy result kept in TopicSnapshot. A view reads one row and never waits for the scan: a stored value is returned even
 * when it is older than `ttlMs` (a refresh then runs after the response, one at a time per instance, under the heavy-scan
 * limit). A failed compute stores nothing and the next view tries again. Only a key never stored computes inline, once.
 * The value must be JSON.
 */
export async function persisted<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const row = await prisma.topicSnapshot.findUnique({ where: { key } }).catch(() => null)
  if (row) {
    if (Date.now() - row.updatedAt.getTime() > ttlMs) refreshInBackground(key, compute)
    return row.data as T
  }
  return computeAndStore(key, compute)
}

/** Recomputes and stores a key now (the cron and the seed script), whatever its age. */
export const storeNow = computeAndStore

/** Which topic filters have a stored snapshot (jobs and stats both), for the sitemap. */
export async function topicsWithSnapshot(): Promise<Set<string>> {
  const rows = await rowsByKey()
  return new Set(topicFilters().map((f) => JSON.stringify(f)).filter((k) => rows.has(`jobs:${k}`)))
}

/**
 * Refreshes the stalest snapshots, one topic at a time, until the time budget runs out. Called by the cron; a topic takes
 * up to about 40 seconds, so each run leaves a margin before the function limit.
 */
export async function refreshTopicSnapshots(budgetMs: number): Promise<{ refreshed: string[]; skipped: number }> {
  const { computeTopicJobs, computeJobStats } = await import('@/lib/seo/topic-data')
  const existing = new Map((await prisma.topicSnapshot.findMany({ select: { key: true, updatedAt: true } })).map((r) => [r.key, r.updatedAt.getTime()]))
  const now = Date.now()
  const due = topicFilters()
    .map((f) => ({ f, key: JSON.stringify(f), at: Math.min(existing.get(`jobs:${JSON.stringify(f)}`) ?? 0, existing.get(`stats:${JSON.stringify(f)}`) ?? 0) }))
    .filter((t) => now - t.at > SNAPSHOT_MAX_AGE_MS)
    .sort((a, b) => a.at - b.at)
  const started = Date.now()
  const refreshed: string[] = []
  for (const t of due) {
    if (Date.now() - started > budgetMs) break
    const jobs = await computeTopicJobs(t.f)
    const stats = await computeJobStats(t.f)
    await prisma.topicSnapshot.upsert({ where: { key: `jobs:${t.key}` }, create: { key: `jobs:${t.key}`, data: jobs as object }, update: { data: jobs as object, updatedAt: new Date() } })
    if (stats) await prisma.topicSnapshot.upsert({ where: { key: `stats:${t.key}` }, create: { key: `stats:${t.key}`, data: stats as object }, update: { data: stats as object, updatedAt: new Date() } })
    refreshed.push(t.key.slice(0, 60))
  }
  return { refreshed, skipped: due.length - refreshed.length }
}
