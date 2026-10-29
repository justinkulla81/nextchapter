import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { readableType } from '@/lib/warn/public-tracker'
import { announcementKind } from '@/lib/warn/company-announcements'

// The list behind CRM > WARN > Layoff publishing: the layoffs worth pushing by hand (recent announcements and buyouts,
// plus large new WARN filings), with where each stands: in the layoff RSS feed, posted to LinkedIn, indexing requested.

const DAY_MS = 86_400_000
const ANNOUNCEMENT_DAYS = 90
const FILING_DAYS = 14
const FILING_MIN_WORKERS = 100
const MAX_ROWS = 80

export type LayoffType = 'warn' | 'news' | 'buyout'
export type LinkedInState = 'POSTED' | 'DRAFT' | 'SKIPPED' | null

export interface PublishingRow {
  noticeId: string
  employer: string
  kind: 'announcement' | 'filing'
  /** WARN filing, a news-reported layoff, or a buyout offer. */
  type: LayoffType
  /** Two-letter US state; null for a layoff with no U.S. state (a global cut, a foreign government). */
  state: string | null
  summary: string | null
  workers: number | null
  date: Date
  path: string
  /** Announcements only: when an admin published it to the layoff RSS feed. WARN filings are in the feed on their own. */
  rssPublishedAt: Date | null
  linkedin: LinkedInState
  linkedinPostedAt: Date | null
  indexRequestedAt: Date | null
}

export async function loadPublishingQueue(now = new Date()): Promise<{ rows: PublishingRow[]; requestsLast24h: number }> {
  const select = {
    id: true, employer: true, employees: true, state: true, noticeDate: true, layoffType: true, source: true, rssPublishedAt: true,
    companyMatchStatus: true, company: { select: { name: true } }, linkedinDraft: { select: { status: true, postedAt: true } },
  } as const
  const [announcements, filings, requests] = await Promise.all([
    prisma.warnNotice.findMany({
      where: { source: 'MANUAL_ANNOUNCEMENT', dismissedAt: null, noticeDate: { gte: new Date(now.getTime() - ANNOUNCEMENT_DAYS * DAY_MS), lte: now } },
      orderBy: { noticeDate: 'desc' }, take: MAX_ROWS, select,
    }),
    prisma.warnNotice.findMany({
      where: { source: { not: 'MANUAL_ANNOUNCEMENT' }, dismissedAt: null, employees: { gte: FILING_MIN_WORKERS }, noticeDate: { gte: new Date(now.getTime() - FILING_DAYS * DAY_MS), lte: now } },
      orderBy: { employees: 'desc' }, take: MAX_ROWS, select,
    }),
    prisma.layoffIndexRequest.findMany({ select: { path: true, requestedAt: true } }),
  ])
  const requested = new Map(requests.map((r) => [r.path, r.requestedAt]))
  const rows: PublishingRow[] = [...announcements, ...filings].flatMap((n) => {
    const matched = n.companyMatchStatus === 'MATCHED' ? n.company?.name ?? null : null
    const slug = employerSlug(n.employer, matched)
    if (!slug || !n.noticeDate) return []
    const path = `/layoffs/company/${slug}`
    const summary = readableType(n.layoffType)
    const announced = n.source === 'MANUAL_ANNOUNCEMENT'
    return [{
      noticeId: n.id,
      employer: n.employer,
      kind: announced ? 'announcement' as const : 'filing' as const,
      type: !announced ? 'warn' as const : announcementKind(summary) === 'buyout' ? 'buyout' as const : 'news' as const,
      state: n.state,
      summary,
      workers: n.employees,
      date: n.noticeDate,
      path,
      rssPublishedAt: n.rssPublishedAt,
      linkedin: n.linkedinDraft?.status ?? null,
      linkedinPostedAt: n.linkedinDraft?.postedAt ?? null,
      indexRequestedAt: requested.get(path) ?? null,
    }]
  })
  const since = now.getTime() - DAY_MS
  return { rows, requestsLast24h: requests.filter((r) => r.requestedAt.getTime() >= since).length }
}
