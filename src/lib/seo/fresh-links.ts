import 'server-only'
import { getRecentNotices } from '@/lib/seo/topic-data'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { heavy } from '@/lib/db/heavy'
import { PUBLIC_JOB_MIN_INDEX_DESCRIPTION } from '@/lib/jobs/public-job-page'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_OFFERED_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'

// The newest layoff pages and job pages, as plain links for the home page and /news. Their job is crawling: a page that is
// linked from a busy page is found in hours, not weeks, and every new page gets its first internal link here. Only pages
// that are indexable are listed (a WARN filing in the last 12 months, a recent announcement, a job with a public page and
// stated pay). Reads only cached sources; any failure returns an empty list and the section simply does not render.

export interface FreshLink {
  label: string
  href: string
  kind: 'layoff' | 'job'
  key: string
}

const LAYOFF_LINKS = 10
const JOB_LINKS = 8

export async function getFreshLayoffLinks(): Promise<FreshLink[]> {
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
    .slice(0, LAYOFF_LINKS)
    .map((x) => ({ label: `${x.name} layoffs`, href: `/layoffs/company/${x.slug}`, kind: 'layoff' as const, key: x.slug }))
}

// The newest jobs that are in the job sitemap (public page, real posting text, live, offered to search engines): the same SQL as
// src/app/jobs/sitemap.ts, newest first, eight rows. Cached for half an hour so a page view never runs it.
const newestOfferedJobs = unstable_cache(
  () => heavy(() => prisma.$queryRaw<{ id: string; title: string; companyName: string }[]>`
    SELECT id, title, "companyName" FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
      AND ${PUBLIC_JOB_LIVE_SQL}
      AND ${PUBLIC_JOB_OFFERED_SQL}
    ORDER BY coalesce("postedAt", "createdAt") DESC
    LIMIT ${JOB_LINKS}`),
  ['fresh-job-links-v1'],
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
