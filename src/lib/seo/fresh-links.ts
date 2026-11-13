import 'server-only'
import { getRecentNotices } from '@/lib/seo/topic-data'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { heavy } from '@/lib/db/heavy'
import { loadSearchPerformance } from '@/lib/google/search-performance'
import { risingPages } from '@/lib/seo/rising-pages'
import { PUBLIC_JOB_MIN_INDEX_DESCRIPTION } from '@/lib/jobs/public-job-page'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_OFFERED_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'

// The newest layoff pages and job pages, as plain links for the home page and /news. Their job is crawling: a page that is
// linked from a busy page is found in hours, not weeks, and every new page gets its first internal link here. Only pages
// that are indexable are listed (a WARN filing in the last 12 months, a recent announcement, a job with a public page and
// stated pay). Reads only cached sources; any failure returns an empty list and the section simply does not render.

export interface FreshLink {
  label: string
  href: string
  kind: 'layoff' | 'job' | 'search' | 'tool' | 'ranking' | 'report'
  key: string
}

const LAYOFF_LINKS = 10
const JOB_LINKS = 8

export async function getFreshLayoffLinks(limit: number = LAYOFF_LINKS): Promise<FreshLink[]> {
  const [notices, announcements] = await Promise.all([getRecentNotices().catch(() => []), getAnnouncements().catch(() => new Map())])
  const byDate = new Map<string, { slug: string; name: string; at: number; workers: number | null }>()
  for (const n of notices) {
    const at = Date.parse(n.noticeDate)
    const prev = byDate.get(n.slug)
    if (!prev || at > prev.at) byDate.set(n.slug, { slug: n.slug, name: n.employer, at, workers: n.workers })
    else if (prev && n.workers && (prev.workers ?? 0) < n.workers && at === prev.at) prev.workers = n.workers
  }
  for (const a of announcements.values()) {
    if (!hasRecentAnnouncement(a)) continue
    const at = a.latest.getTime()
    const prev = byDate.get(a.slug)
    if (!prev || at > prev.at) byDate.set(a.slug, { slug: a.slug, name: a.name, at, workers: prev?.workers ?? null })
  }
  return [...byDate.values()]
    .filter((x) => x.slug && x.name)
    .sort((a, b) => b.at - a.at || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, limit)
    .map((x) => ({ label: `${x.name} layoffs`, href: `/layoffs/company/${x.slug}`, kind: 'layoff' as const, key: x.slug }))
}

const BIG_LAYOFF_WORKERS = 1000
const BIG_LAYOFF_DAYS = 7

/**
 * Big layoffs first (owner, 2026-11-13): employers cutting at least 1,000 jobs in the last week, largest first, with the number in the
 * link. "<company> layoffs" searches peak in the first days, and the homepage and the layoff hub are the pages Google rechecks most.
 * Pure so the window and the sum can be tested; the loader below reads the same shared notices and announcements as the list above.
 */
export function bigLayoffs(
  notices: { slug: string; employer: string; noticeDate: string; workers: number | null }[],
  announcements: { slug: string; name: string; items: { date: Date; workers: number | null; summary?: string }[] }[],
  now: number,
  limit = 8,
): FreshLink[] {
  const since = now - BIG_LAYOFF_DAYS * 86_400_000
  const by = new Map<string, { name: string; workers: number }>()
  for (const n of notices) {
    if (!n.slug || !n.workers || Date.parse(n.noticeDate) < since) continue
    const prev = by.get(n.slug)
    by.set(n.slug, { name: prev?.name ?? n.employer, workers: (prev?.workers ?? 0) + n.workers })
  }
  for (const a of announcements) {
    // Only a confirmed figure leads the homepage: a single unconfirmed report ("Voestalpine: 150,000", 2026-11-13) can be far off.
    const top = Math.max(0, ...a.items.filter((i) => i.date.getTime() >= since && i.workers && !/unconfirmed/i.test(i.summary ?? '')).map((i) => i.workers as number))
    if (!a.slug || top === 0) continue
    const prev = by.get(a.slug)
    // A press report and a filing are usually the same cut: keep the larger figure, never the sum.
    if (!prev || top > prev.workers) by.set(a.slug, { name: prev?.name ?? a.name, workers: top })
  }
  return [...by.entries()]
    .filter(([, v]) => v.workers >= BIG_LAYOFF_WORKERS && v.name)
    .sort((a, b) => b[1].workers - a[1].workers)
    .slice(0, limit)
    .map(([slug, v]) => ({ label: `${v.name} layoffs: ${v.workers.toLocaleString('en-US')} jobs`, href: `/layoffs/company/${slug}`, kind: 'layoff' as const, key: slug }))
}

export async function getBigLayoffLinks(limit = 8): Promise<FreshLink[]> {
  const [notices, announcements] = await Promise.all([getRecentNotices().catch(() => []), getAnnouncements().catch(() => new Map())])
  return bigLayoffs(notices, [...announcements.values()], Date.now(), limit)
}

// The newest jobs that are in the job sitemap (public page, real posting text, live, offered to search engines): the same rules as
// src/app/jobs/sitemap.ts, newest first, eight rows. Cached for half an hour so a page view never runs it.
// It first takes the newest NEWEST_WINDOW postings by creation date (an index walk) and only then applies the full rules, which
// read each row's description. Filtering the whole table first ran 100 seconds or more per call, four at a time, and held
// database connections (seen 2026-11-02). The window holds dozens of qualifying jobs, far more than the eight shown.
const NEWEST_WINDOW = 5000
const newestOfferedJobs = unstable_cache(
  () => heavy(() => prisma.$queryRaw<{ id: string; title: string; companyName: string }[]>`
    SELECT id, title, "companyName" FROM (
      SELECT * FROM "ExclusiveJobPosting"
      WHERE status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT ${NEWEST_WINDOW}
    ) AS "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
      AND ${PUBLIC_JOB_LIVE_SQL}
      AND ${PUBLIC_JOB_OFFERED_SQL}
    ORDER BY coalesce("postedAt", "createdAt") DESC
    LIMIT ${JOB_LINKS}`),
  ['fresh-job-links-v2'],
  { revalidate: 1800 },
)

export async function getFreshJobLinks(): Promise<FreshLink[]> {
  try {
    const rows = await newestOfferedJobs()
    return rows.map((j) => ({ label: `${j.title}, ${j.companyName}`, href: `/jobs/${j.id}`, kind: 'job' as const, key: j.id }))
  } catch {
    return []
  }
}

/**
 * Pages Google shows at positions 8 to 20 for a real search, linked with that search as the link text. Reads the Search Console
 * window cached for an hour (src/lib/google/search-performance.ts). Any failure, or no Google connection, returns an empty list and
 * the section does not render.
 */
export async function getRisingSearchLinks(limit = 8, prefixes?: readonly string[]): Promise<FreshLink[]> {
  try {
    const perf = await loadSearchPerformance(28)
    if (perf.status !== 'ok') return []
    return risingPages(perf.rows, { limit, prefixes }).map((p) => ({
      label: p.query.charAt(0).toUpperCase() + p.query.slice(1),
      href: p.path,
      kind: 'search' as const,
      key: p.path,
    }))
  } catch {
    return []
  }
}
