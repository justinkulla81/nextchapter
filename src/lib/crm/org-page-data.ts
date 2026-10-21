import 'server-only'
import { prisma } from '@/lib/prisma'
import { buildLayoffTimeline } from '@/lib/companies/layoff-timeline'
import { buildLayoffYear } from '@/lib/companies/layoff-year'
import { LAYOFF_WINDOW_MONTHS } from '@/lib/crm/layoff-signals'

// The organization page's demand-side data: open jobs, candidates who want to
// work here, layoffs, and news. Everything keys on the org itself — its linked
// Company id where there is one, otherwise the same normalized name the CRM
// keys organizations by — so an org with no Company link is still found.
//
// No metered calls and no new tables: all of this is already collected by the
// job board, candidates' job applications, the WARN sync and the layoff-news sweep.

const DAY_MS = 24 * 60 * 60 * 1000

let trackingStartCache: { at: number; value: Date | null } | null = null
async function boardTrackingStart(): Promise<Date | null> {
  if (trackingStartCache && Date.now() - trackingStartCache.at < 60 * 60 * 1000) return trackingStartCache.value
  const row = await prisma.exclusiveJobPosting.aggregate({ _min: { createdAt: true } })
  trackingStartCache = { at: Date.now(), value: row._min.createdAt }
  return row._min.createdAt
}

const fullName = (c: { firstName: string | null; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'

export interface OrgRef {
  id: string
  name: string
  canonicalNameNormalized: string
  companyId: string | null
}

export async function loadOrgDemandData(org: OrgRef) {
  const since = new Date()
  since.setMonth(since.getMonth() - LAYOFF_WINDOW_MONTHS)
  const byName = { equals: org.name, mode: 'insensitive' as const }
  const synthetic = org.canonicalNameNormalized.startsWith('-')

  const postingOr = [
    ...(org.companyId ? [{ companyId: org.companyId }] : []),
    { companyName: byName },
  ]
  const noticeOr = [
    { normalizedEmployer: org.canonicalNameNormalized },
    ...(org.companyId ? [{ companyId: org.companyId }] : []),
  ]

  const yearAgo = new Date(Date.now() - 365 * DAY_MS)
  const [postings, applied, notices, layoffNews, researchNews, trackingStart, yearMentions, intakeMandates, searchRequests] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { OR: postingOr, status: 'approved', institutionScopeId: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, title: true, location: true, url: true, level: true, postingType: true, sourceName: true,
        badges: true, postedAt: true, createdAt: true, archivedAt: true, disclosure: true,
        salaryMin: true, salaryMax: true, salaryCurrency: true,
      },
    }),
    prisma.jobPosting.findMany({
      where: { companyName: byName, appliedAt: { not: null } },
      orderBy: { appliedAt: 'desc' },
      take: 50,
      select: { title: true, appliedAt: true, declinedAt: true, interviewLandedAt: true, offerReceivedAt: true,
        candidate: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.warnNotice.findMany({
      where: { OR: noticeOr, dismissedAt: null },
      orderBy: [{ noticeDate: 'desc' }, { fetchedAt: 'desc' }],
      take: 25,
      select: { id: true, state: true, employer: true, noticeDate: true, effectiveDate: true, employees: true,
        layoffType: true, sourceUrl: true, source: true, fetchedAt: true },
    }),
    synthetic ? Promise.resolve([]) : prisma.layoffNewsMention.findMany({
      where: { companyKey: org.canonicalNameNormalized },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: { id: true, headline: true, url: true, publisher: true, employees: true, publishedAt: true },
    }),
    // Items in the research library that name this organization. Short names
    // ("Meta", "Box") would match half the library, so require a real name.
    org.name.trim().length >= 5
      ? prisma.researchLibraryItem.findMany({
          where: { title: { contains: org.name.trim(), mode: 'insensitive' }, fetchFailed: false, status: { not: 'dismissed' } },
          orderBy: { dateFound: 'desc' },
          take: 8,
          select: { id: true, title: true, url: true, dateFound: true, summary: true },
        })
      : Promise.resolve([]),
    boardTrackingStart(),
    // Every mention of the past year, not just the ten shown, so the year total sees them all.
    synthetic ? Promise.resolve([]) : prisma.layoffNewsMention.findMany({
      where: { companyKey: org.canonicalNameNormalized, publishedAt: { gte: yearAgo } },
      select: { noticeId: true, publishedAt: true, employees: true, publisher: true },
    }),
    // Recruiters' open mandates naming this organization as the client. Admin-only:
    // the client is hidden from candidates on every other surface.
    prisma.intakeSearch.findMany({
      where: { status: 'OPEN', clientName: byName },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, location: true, createdAt: true,
        recruiter: { select: { fullName: true } }, firm: { select: { name: true } } },
    }),
    prisma.searchRequest.findMany({
      where: { status: { not: 'CLOSED' }, clientName: byName },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, roleTitle: true, location: true, createdAt: true, firmName: true, contactName: true, confidential: true },
    }),
  ])

  const openJobs = postings.filter((p) => p.archivedAt === null)

  // Candidates, one row per person, with what they have done about this company.
  // Applications only. A candidate's watchlist is private search data the CRM
  // must not read (src/test/company-wall.test.ts).
  const candidates = new Map<string, {
    id: string; name: string
    applied: { title: string | null; at: Date; outcome: 'offer' | 'interview' | 'declined' | 'applied' }[]
  }>()
  const slot = (c: { id: string; firstName: string | null; lastName: string | null }) => {
    let row = candidates.get(c.id)
    if (!row) { row = { id: c.id, name: fullName(c), applied: [] }; candidates.set(c.id, row) }
    return row
  }
  for (const a of applied) {
    if (!a.appliedAt) continue
    slot(a.candidate).applied.push({
      title: a.title,
      at: a.appliedAt,
      outcome: a.offerReceivedAt ? 'offer' : a.interviewLandedAt ? 'interview' : a.declinedAt ? 'declined' : 'applied',
    })
  }
  const wantToWork = [...candidates.values()].sort((a, b) => b.applied.length - a.applied.length || a.name.localeCompare(b.name))

  const layoffTimeline = buildLayoffTimeline({
    notices: notices
      .filter((n): n is typeof n & { noticeDate: Date } => n.noticeDate !== null)
      .map((n) => ({ noticeDate: n.noticeDate, employees: n.employees, layoffType: n.layoffType, sourceUrl: n.sourceUrl })),
    postings: postings.map((p) => ({ createdAt: p.createdAt, function: null })),
    trackingStart,
  })

  const recent = notices.filter((n) => (n.noticeDate ?? n.fetchedAt) >= since)
  const latest = recent.reduce<Date | null>((m, n) => {
    const d = n.noticeDate ?? n.fetchedAt
    return !m || d > m ? d : m
  }, null)
  const counted = recent.filter((n) => n.employees != null)
  const layoffSummary = {
    notices: recent.length,
    employees: counted.length ? counted.reduce((s, n) => s + (n.employees ?? 0), 0) : null,
    daysSinceLatest: latest ? Math.max(0, Math.floor((Date.now() - latest.getTime()) / DAY_MS)) : null,
    hiringAgain: layoffTimeline.status === 'hiring_again',
  }

  const layoffYear = buildLayoffYear({
    notices: notices
      .filter((n): n is typeof n & { noticeDate: Date } => n.noticeDate !== null)
      .map((n) => ({ noticeDate: n.noticeDate, employees: n.employees })),
    mentions: yearMentions,
  })

  const mandates = [
    ...intakeMandates.map((m) => ({
      id: m.id, role: m.title, location: m.location, since: m.createdAt,
      by: [m.recruiter.fullName, m.firm.name].filter(Boolean).join(', '), kind: 'Recruiter intake' as const,
    })),
    ...searchRequests.map((r) => ({
      id: r.id, role: r.roleTitle, location: r.location, since: r.createdAt,
      by: [r.contactName, r.firmName].filter(Boolean).join(', '), kind: (r.confidential ? 'Confidential search request' : 'Search request') as string,
    })),
  ]

  const newPostings90d = postings.filter((p) => p.createdAt.getTime() >= Date.now() - 90 * DAY_MS).length
  const seniorRoles = openJobs.filter((j) => j.level && /DIRECTOR|VP|EVP|SVP|C_SUITE/.test(j.level)).length

  return {
    openJobs,
    seniorRoles,
    wantToWork,
    appliedCount: new Set(applied.filter((a) => a.appliedAt).map((a) => a.candidate.id)).size,
    notices,
    layoffTimeline,
    layoffSummary,
    layoffYear,
    mandates,
    newPostings90d,
    layoffNews,
    researchNews,
  }
}

export type OrgDemandData = Awaited<ReturnType<typeof loadOrgDemandData>>
