import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'

// Asking people who used to work somewhere what it is like, and telling them when it
// helped.
//
//   REQUEST  when a company a member worked for (a job on their resume that has ended)
//            is hiring, ask for anonymous feedback on it — culture and how they treat
//            candidates — which then appears on that company's page for other members.
//   IMPACT   once they have shared, tell them how many members looked at the company
//            and how many applied since. Counts under the privacy floor are reported
//            only as "fewer than 5", never as the number.
//
// A member in Confidential Search Mode is never asked, and a CURRENT employer is never
// asked about: someone still working there is the person a leaked answer harms most.

export const FEEDBACK_INTEL_TYPES = ['culture', 'hiring_practices'] as const

export interface FeedbackRequest {
  companyId: string
  companyName: string
  /** Path segment of the company page: /dashboard/companies/{slug} */
  slug: string
  openRoles: number
}

const MAX_REQUESTS = 3

export async function getFeedbackRequests(candidateId: string): Promise<FeedbackRequest[]> {
  const me = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { confidentialSearchMode: true } })
  if (!me || me.confidentialSearchMode) return []

  const [work, undated] = await Promise.all([
    prisma.workHistoryEntry.findMany({ where: { candidateId, companyId: { not: null } }, select: { companyId: true, isCurrent: true } }),
    prisma.undatedEmployment.findMany({ where: { candidateId, companyId: { not: null } }, select: { companyId: true, isCurrent: true } }),
  ])
  const all = [...work, ...undated]
  const currentlyThere = new Set(all.filter((w) => w.isCurrent).map((w) => w.companyId!))
  const former = [...new Set(all.filter((w) => !w.isCurrent).map((w) => w.companyId!))].filter((id) => !currentlyThere.has(id))
  if (former.length === 0) return []

  const [open, already] = await Promise.all([
    prisma.exclusiveJobPosting.groupBy({
      by: ['companyId'],
      where: { companyId: { in: former }, archivedAt: null, status: 'approved' },
      _count: { _all: true },
    }),
    prisma.companyIntel.findMany({
      where: { contributorCandidateId: candidateId, companyId: { in: former }, intelType: { in: [...FEEDBACK_INTEL_TYPES] } },
      select: { companyId: true },
    }),
  ])
  const shared = new Set(already.map((a) => a.companyId))
  const hiring = open.filter((o) => o.companyId && !shared.has(o.companyId))
  if (hiring.length === 0) return []

  const companies = await prisma.company.findMany({
    where: { id: { in: hiring.map((h) => h.companyId!) } },
    select: { id: true, name: true, canonicalNameNormalized: true },
  })
  return hiring
    .map((h) => {
      const c = companies.find((x) => x.id === h.companyId)
      return c ? { companyId: c.id, companyName: c.name, slug: c.canonicalNameNormalized, openRoles: h._count._all } : null
    })
    .filter((r): r is FeedbackRequest => r !== null)
    .sort((a, b) => b.openRoles - a.openRoles)
    .slice(0, MAX_REQUESTS)
}

export interface FeedbackImpact {
  companyName: string
  slug: string
  /** Exact count when at least the privacy floor, otherwise null (shown as "fewer than 5"). */
  viewed: number | null
  viewedAny: boolean
  applied: number | null
  appliedAny: boolean
}

const floor = (n: number) => (n >= MIN_CELL_SIZE ? n : null)

export async function getFeedbackImpact(candidateId: string): Promise<FeedbackImpact[]> {
  const shared = await prisma.companyIntel.findMany({
    where: { contributorCandidateId: candidateId, status: 'published', intelType: { in: [...FEEDBACK_INTEL_TYPES] } },
    select: { companyId: true, createdAt: true, company: { select: { name: true, canonicalNameNormalized: true } } },
    orderBy: { createdAt: 'asc' },
  })
  // Earliest published item per company is the "since" moment.
  const firstByCompany = new Map<string, (typeof shared)[number]>()
  for (const s of shared) if (!firstByCompany.has(s.companyId)) firstByCompany.set(s.companyId, s)

  const out: FeedbackImpact[] = []
  for (const s of firstByCompany.values()) {
    const slug = s.company.canonicalNameNormalized
    const paths = [`/dashboard/companies/${slug}`, `/dashboard/companies/${encodeURIComponent(slug)}`]
    const [views, apps] = await Promise.all([
      prisma.candidatePageActivityEvent.findMany({
        where: {
          eventType: 'PAGE_VIEW',
          path: { in: paths },
          candidateId: { not: candidateId },
          createdAt: { gte: s.createdAt },
          candidate: { confidentialSearchMode: false, isSystemAccount: false, isSampleData: false },
        },
        select: { candidateId: true },
        distinct: ['candidateId'],
      }),
      prisma.jobPosting.findMany({
        where: {
          companyName: { equals: s.company.name, mode: 'insensitive' },
          candidateId: { not: candidateId },
          appliedAt: { gte: s.createdAt },
          candidate: { confidentialSearchMode: false, isSystemAccount: false, isSampleData: false },
        },
        select: { candidateId: true },
        distinct: ['candidateId'],
      }),
    ])
    out.push({
      companyName: s.company.name,
      slug,
      viewed: floor(views.length),
      viewedAny: views.length > 0,
      applied: floor(apps.length),
      appliedAny: apps.length > 0,
    })
  }
  return out
}
