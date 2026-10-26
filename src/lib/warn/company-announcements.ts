import 'server-only'
import { cache } from 'react'
import { heavy, memoTtl } from '@/lib/db/heavy'
import { prisma } from '@/lib/prisma'
import { cleanEmployer, readableType } from './public-tracker'
import { employerSlug, TWELVE_MONTHS_MS } from './layoff-pages'

// Employer announcements and press-reported workforce actions (buyout offers, reported layoffs, hiring cuts): the
// MANUAL_ANNOUNCEMENT rows the tracker holds. They are not WARN filings, so they never feed the notice or worker
// totals; the employer's layoff page lists them apart, each labeled as an announcement with its source.

export type AnnouncementKind = 'buyout' | 'layoff'

export interface CompanyAnnouncement {
  id: string
  date: Date
  kind: AnnouncementKind
  /** The tracker's own one-line description, e.g. "Voluntary buyout offered to about 60,000 employees". */
  summary: string
  workers: number | null
  sourceUrl: string | null
}

export interface CompanyAnnouncements {
  slug: string
  name: string
  items: CompanyAnnouncement[]
  latest: Date
}

const BUYOUT = /buy-?out|voluntary (separation|departure|exit|retirement)|early retirement|severance offer/i

export const announcementKind = (summary: string | null): AnnouncementKind => (summary && BUYOUT.test(summary) ? 'buyout' : 'layoff')

async function load(): Promise<Map<string, CompanyAnnouncements>> {
  const rows = await prisma.warnNotice.findMany({
    where: {
      dismissedAt: null,
      source: 'MANUAL_ANNOUNCEMENT',
      noticeDate: { not: null, lte: new Date() },
      // A bare NOT(contains) drops rows whose sourceUrl is NULL, and a company announcement may have no link.
      OR: [{ sourceUrl: null }, { NOT: { sourceUrl: { contains: 'layoffs.fyi', mode: 'insensitive' } } }],
    },
    select: { id: true, employer: true, employees: true, noticeDate: true, layoffType: true, sourceUrl: true, companyMatchStatus: true, company: { select: { name: true } } },
    orderBy: { noticeDate: 'desc' },
  })
  const by = new Map<string, CompanyAnnouncements>()
  for (const r of rows) {
    const matched = r.companyMatchStatus === 'MATCHED' ? r.company?.name ?? null : null
    const slug = employerSlug(r.employer, matched)
    if (!slug) continue
    const summary = readableType(r.layoffType)
    if (!summary) continue // an announcement with no description says nothing a visitor can use
    const entry = by.get(slug) ?? { slug, name: cleanEmployer(r.employer, matched), items: [], latest: r.noticeDate! }
    entry.items.push({
      id: r.id,
      date: r.noticeDate!,
      kind: announcementKind(summary),
      summary,
      workers: r.employees,
      sourceUrl: r.sourceUrl && /^https:\/\//.test(r.sourceUrl) ? r.sourceUrl : null,
    })
    if (r.noticeDate! > entry.latest) entry.latest = r.noticeDate!
    by.set(slug, entry)
  }
  return by
}

const shared = memoTtl(5 * 60_000, () => 'all', () => heavy(load))

/** Every employer with a published announcement, keyed by layoff-page slug. */
export const getAnnouncements = cache(() => shared())

/** An announcement in the last 12 months makes the employer's page worth a search result even with no WARN filing. */
export const hasRecentAnnouncement = (a: CompanyAnnouncements | undefined, now = Date.now()): boolean =>
  !!a && now - a.latest.getTime() <= TWELVE_MONTHS_MS
