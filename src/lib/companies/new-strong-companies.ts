import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadCompanyRankingData } from '@/lib/companies/company-ranking-data'
import { rankCompanies } from '@/lib/companies/company-ranking'

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

// Ids of Strong-fit companies with something new since `since`. Contacts are
// left out of the score here (the nav badge runs on every dashboard page and
// the contact match is the one per-member slow step) — own contacts can only
// ever raise a company further, never make a strong one weak.
export async function getNewStrongCompanyIds(candidateId: string, since: Date): Promise<Set<string>> {
  const { candidate, companies } = await loadCompanyRankingData(candidateId, { includeContacts: false })
  const ids = new Set<string>()
  for (const { company, ranking } of rankCompanies(companies, candidate)) {
    if (ranking.band === 'strong' && company.latestPostingAt !== null && company.latestPostingAt > since.getTime()) {
      ids.add(company.id)
    }
  }
  return ids
}

export async function countNewStrongCompanies(candidateId: string): Promise<number> {
  const since = await getLastCompaniesVisit(candidateId)
  if (!since) return 0
  return (await getNewStrongCompanyIds(candidateId, since)).size
}
