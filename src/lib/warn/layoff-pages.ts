import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { cityFromAddress } from '@/lib/workforce/places'
import { cleanEmployer, readableType } from './public-tracker'

// Data for the public /layoffs pages: WARN notices as filed with state labor
// departments. Reported layoffs (layoffs.fyi, press) are not WARN notices and
// stay on the main tracker only. Facts only — nothing here ranks employers or
// says anything about individual workers.

const DAY_MS = 24 * 60 * 60 * 1000
export const TWELVE_MONTHS_MS = 365 * DAY_MS
export const TWENTY_FOUR_MONTHS_MS = 2 * 365 * DAY_MS

/**
 * The URL slug for an employer. Built from the cleaned name so one employer's
 * filings land on one page however a state wrote it: "Grunt Style" in Arizona
 * and "Grunt Style, LLC 4267 Legendary Drive … Destin FL 32541" in Florida
 * are both /layoffs/company/grunt-style.
 */
export function employerSlug(rawEmployer: string, matchedCompanyName: string | null): string {
  const name = cleanEmployer(rawEmployer.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+-\s+.*$/, ''), matchedCompanyName)
  return normalizeOrgName(name).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export interface PublicNotice {
  id: string
  state: string
  employer: string
  slug: string
  /** City or county, whichever the filing gives. */
  place: string | null
  workers: number | null
  noticeDate: Date
  effectiveDate: Date | null
  type: string | null
  sourceUrl: string | null
  board: { id: string; name: string; website: string | null; zip: string | null } | null
}

/** Every WARN filing on the public record, newest first. Cached per request. */
export const getPublicNotices = cache(async (): Promise<PublicNotice[]> => {
  const rows = await prisma.warnNotice.findMany({
    where: {
      dismissedAt: null,
      source: 'WARN_FILING',
      state: { not: null },
      noticeDate: { not: null, lte: new Date() },
      NOT: { sourceUrl: { contains: 'layoffs.fyi', mode: 'insensitive' } },
    },
    select: {
      id: true, state: true, employer: true, county: true, address: true, employees: true,
      noticeDate: true, effectiveDate: true, layoffType: true, sourceUrl: true, workforceBoardId: true,
      companyMatchStatus: true, company: { select: { name: true } },
    },
    orderBy: [{ noticeDate: 'desc' }, { employees: 'desc' }],
  })
  const boardIds = [...new Set(rows.map((r) => r.workforceBoardId).filter((x): x is string => !!x))]
  const boards = boardIds.length
    ? await prisma.workforceBoard.findMany({ where: { id: { in: boardIds } }, select: { id: true, name: true, website: true, zip: true } })
    : []
  const boardById = new Map(boards.map((b) => [b.id, b]))
  return rows.map((r) => {
    const company = r.companyMatchStatus === 'MATCHED' ? r.company?.name ?? null : null
    const county = r.county?.replace(/\s+(County|Parish)$/i, '').trim() || null
    return {
      id: r.id,
      state: r.state!,
      employer: cleanEmployer(r.employer, company),
      slug: employerSlug(r.employer, company),
      // Florida writes the site address into the employer field instead.
      place: county ? `${county} County` : cityFromAddress(r.address, r.state) ?? cityFromAddress(r.employer, r.state),
      workers: r.employees,
      noticeDate: r.noticeDate!,
      effectiveDate: r.effectiveDate,
      type: readableType(r.layoffType),
      sourceUrl: r.sourceUrl && /^https:\/\//.test(r.sourceUrl) ? r.sourceUrl : null,
      board: r.workforceBoardId ? boardById.get(r.workforceBoardId) ?? null : null,
    }
  })
})

export interface StateSummary {
  state: string
  /** Notices in the last 12 months. */
  recent: number
  recentWorkers: number
  latest: Date
  /** Every notice on file for the state. */
  earliestOnFile: Date
}

/** States with at least one notice in the last 12 months, plus their counts. */
export async function getStateSummaries(): Promise<StateSummary[]> {
  const notices = await getPublicNotices()
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const by = new Map<string, StateSummary>()
  for (const n of notices) {
    const s = by.get(n.state) ?? { state: n.state, recent: 0, recentWorkers: 0, latest: n.noticeDate, earliestOnFile: n.noticeDate }
    if (n.noticeDate.getTime() >= cutoff) {
      s.recent++
      s.recentWorkers += n.workers ?? 0
    }
    if (n.noticeDate > s.latest) s.latest = n.noticeDate
    if (n.noticeDate < s.earliestOnFile) s.earliestOnFile = n.noticeDate
    by.set(n.state, s)
  }
  return [...by.values()].filter((s) => s.recent > 0)
}

export interface CompanySummary {
  slug: string
  name: string
  notices: PublicNotice[]
  latest: Date
  states: string[]
}

/** Every employer with at least one notice, keyed by slug. */
export async function getCompanies(): Promise<Map<string, CompanySummary>> {
  const notices = await getPublicNotices()
  const by = new Map<string, CompanySummary>()
  for (const n of notices) {
    if (!n.slug) continue
    const c = by.get(n.slug) ?? { slug: n.slug, name: n.employer, notices: [], latest: n.noticeDate, states: [] }
    c.notices.push(n)
    if (n.noticeDate > c.latest) c.latest = n.noticeDate
    if (!c.states.includes(n.state)) c.states.push(n.state)
    by.set(n.slug, c)
  }
  // The display name: the shortest spelling, which is the one without a
  // site address or legal suffix appended.
  for (const c of by.values()) c.name = c.notices.map((n) => n.employer).sort((a, b) => a.length - b.length)[0]
  return by
}

/** Press reports that name the employer, newest first. */
export async function getNewsMentions(company: CompanySummary) {
  const keys = [...new Set(company.notices.map((n) => normalizeOrgName(n.employer)))]
  return prisma.layoffNewsMention.findMany({
    where: { OR: [{ companyKey: { in: keys } }, { noticeId: { in: company.notices.map((n) => n.id) } }] },
    select: { id: true, headline: true, url: true, publisher: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  })
}

/** "Oct 1, 2026", as a calendar date. */
export const noticeDay = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
