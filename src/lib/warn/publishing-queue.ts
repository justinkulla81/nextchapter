import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { readableType } from '@/lib/warn/public-tracker'

// The list behind CRM > WARN > Layoff publishing: the layoffs worth pushing by hand (recent announcements and buyouts,
// plus large new WARN filings), with where each stands: in the layoff RSS feed, posted to LinkedIn, indexing requested.

const DAY_MS = 86_400_000
const ANNOUNCEMENT_DAYS = 90
const FILING_DAYS = 14
const FILING_MIN_WORKERS = 100
const MAX_ROWS = 80

export type LinkedInState = 'POSTED' | 'DRAFT' | 'SKIPPED' | null

export interface PublishingRow {
  noticeId: string
  employer: string
  kind: 'announcement' | 'filing'
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
    id: true, employer: true, employees: true, noticeDate: true, layoffType: true, source: true, rssPublishedAt: true,
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
    return [{
      noticeId: n.id,
      employer: n.employer,
      kind: n.source === 'MANUAL_ANNOUNCEMENT' ? 'announcement' as const : 'filing' as const,
      summary: readableType(n.layoffType),
      workers: n.employees,
      date: n.noticeDate,
      path,
      rssPublishedAt: n.rssPublishedAt,
      linkedin: n.linkedinDraft?.status ?? null,
      linkedinPostedAt: n.linkedinDraft?.postedAt ?? null,
      indexRequestedAt: requested.get(path) ?? null,
    }]
  })
  // Most worth pushing first: not yet requested, announcements before filings, then the larger layoff, then the newer one.
  rows.sort((a, b) =>
    Number(!!a.indexRequestedAt) - Number(!!b.indexRequestedAt) ||
    Number(b.kind === 'announcement') - Number(a.kind === 'announcement') ||
    (b.workers ?? 0) - (a.workers ?? 0) ||
    b.date.getTime() - a.date.getTime())
  const since = now.getTime() - DAY_MS
  return { rows: rows.slice(0, MAX_ROWS), requestsLast24h: requests.filter((r) => r.requestedAt.getTime() >= since).length }
}
