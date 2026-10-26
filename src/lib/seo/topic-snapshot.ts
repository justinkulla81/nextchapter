import 'server-only'
import { cache } from 'react'
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
