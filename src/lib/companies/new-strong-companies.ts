import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadCompanyRankingData } from '@/lib/companies/company-ranking-data'
import { rankCompanies, type RankingCandidate, type RankingCompany } from '@/lib/companies/company-ranking'

// "New strong signal" = a company that is a Strong fit for this member AND has
// a posting they can see that appeared since they last opened the Companies
// directory. No stored marker: every dashboard page view is already recorded
// (CandidatePageActivityEvent via DashboardActivityTracker), so "last time
// they opened /dashboard/companies" is the newest PAGE_VIEW on that path.
//
// A member who has never opened the directory has no baseline and gets no
// number — the same "no surprise historical backlog" choice the other
// last-viewed badges make — rather than a count of every strong company.

// The page's own beacon fires AFTER the page renders, so a re-render of the
// page itself (apply a filter, change page) would otherwise see the visit it
// is part of and lose every "New" marker. The page therefore treats visits
// within one session window as one visit.
export const COMPANIES_VISIT_SESSION_MS = 30 * 60 * 1000

export async function getLastCompaniesVisit(candidateId: string, olderThanMs = 0): Promise<Date | null> {
  const event = await prisma.candidatePageActivityEvent.findFirst({
    where: {
      candidateId,
      eventType: 'PAGE_VIEW',
      path: { startsWith: '/dashboard/companies' },
      ...(olderThanMs > 0 ? { createdAt: { lt: new Date(Date.now() - olderThanMs) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return event?.createdAt ?? null
}

// Ids of Strong-fit companies with something new, from an already-loaded ranking
// input. Contacts are left out of the score on purpose (the nav badge counts
// without them, and the page must show the same number): own contacts can only
// ever raise a company further, never make a strong one weak. Rows loaded WITH
// contacts are neutralised here so the result is identical to a
// `includeContacts: false` load.
export function newStrongIdsFromRankingData(
  companies: RankingCompany[],
  candidate: RankingCandidate,
  since: Date
): Set<string> {
  const ids = new Set<string>()
  const sinceMs = since.getTime()
  const withoutContacts = companies.map((c) =>
    c.myContactCount === 0 && c.reach.recruiters === 0 && c.reach.hiringManagers === 0
      ? c
      : { ...c, myContactCount: 0, reach: { recruiters: 0, hiringManagers: 0 } }
  )
  for (const { company, ranking } of rankCompanies(withoutContacts, candidate)) {
    if (ranking.band === 'strong' && company.latestPostingAt !== null && company.latestPostingAt > sinceMs) {
      ids.add(company.id)
    }
  }
  return ids
}

// Ids of Strong-fit companies with something new since `since`.
export async function getNewStrongCompanyIds(candidateId: string, since: Date): Promise<Set<string>> {
  const { candidate, companies } = await loadCompanyRankingData(candidateId, { includeContacts: false })
  return newStrongIdsFromRankingData(companies, candidate, since)
}

// Nav-badge count, run on every hard dashboard load. Cheap exits first:
//  1. never opened the directory -> 0 (unchanged behaviour);
//  2. no live, approved, non-institution posting was created after the last
//     visit -> 0 without ranking the directory. This is exact: a company only
//     counts when its newest NAMEABLE posting (a subset of exactly these rows)
//     is newer than the visit, so no such posting means no company can count.
// Otherwise the full count is computed and held for five minutes per member
// (keyed on the visit time, so a new directory visit recomputes at once).
const COUNT_TTL_MS = 5 * 60 * 1000
const countCache = new Map<string, { at: number; sinceMs: number; count: number }>()

export async function countNewStrongCompanies(candidateId: string): Promise<number> {
  const since = await getLastCompaniesVisit(candidateId)
  if (!since) return 0

  const hit = countCache.get(candidateId)
  if (hit && hit.sinceMs === since.getTime() && Date.now() - hit.at < COUNT_TTL_MS) return hit.count

  const now = new Date()
  const anyNewer = await prisma.exclusiveJobPosting.findFirst({
    where: {
      status: 'approved',
      archivedAt: null,
      institutionScopeId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      createdAt: { gt: since },
    },
    select: { id: true },
  })
  const count = anyNewer ? (await getNewStrongCompanyIds(candidateId, since)).size : 0

  if (countCache.size > 2000) countCache.clear()
  countCache.set(candidateId, { at: Date.now(), sinceMs: since.getTime(), count })
  return count
}
