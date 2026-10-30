import 'server-only'
import { getRecentNotices } from '@/lib/seo/topic-data'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { cleanPublicQuery, searchPublicBoardCached } from '@/lib/jobs/public-board'

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

export async function getFreshJobLinks(): Promise<FreshLink[]> {
  try {
    const result = await searchPublicBoardCached(cleanPublicQuery({ q: '', loc: '', remote: '' }))
    return result.jobs
      .filter((j) => j.pagePath && (j.salaryMin || j.salaryMax))
      .slice(0, JOB_LINKS)
      .map((j) => ({ label: `${j.title}, ${j.company}`, href: j.pagePath!, kind: 'job' as const, key: j.id }))
  } catch {
    return []
  }
}
