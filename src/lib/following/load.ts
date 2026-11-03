import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { loadCompanyRankingData } from '@/lib/companies/company-ranking-data'
import { rankCompanies, type RankedCompany } from '@/lib/companies/company-ranking'
import { getWatchlistView } from '@/lib/company-tracker/watchlist'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { buildFollowRow, pickSuggestions, type FollowRow, type Suggestion } from './build'

export interface FollowedCompanies {
  rows: FollowRow[]
  suggestions: Suggestion[]
  /** True when the member has no city, function or industry yet, so suggestions are thin. */
  profileThin: boolean
}

/**
 * Everything the Companies tab shows for one member: each company they follow with its one verdict, and companies they do not
 * follow that fit them. Reads only. The ranking is the same one the Companies page uses, so a fit reason here never disagrees with it.
 */
export async function loadFollowedCompanies(candidateId: string): Promise<FollowedCompanies> {
  const [entries, view, data, dismissed] = await Promise.all([
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, select: { id: true, companyName: true, createdAt: true } }),
    getWatchlistView(candidateId).catch(() => []),
    loadCompanyRankingData(candidateId),
    // Fail soft: the dismissals table is new, and a missing table must never take the page down.
    prisma.companySuggestionDismissal.findMany({ where: { candidateId }, select: { companyId: true } }).catch(() => []),
  ])
  const ranked = rankCompanies(data.companies, data.candidate)
  const byNorm = new Map<string, RankedCompany>(ranked.map((r) => [r.company.canonicalNameNormalized, r]))
  const viewById = new Map(view.map((v) => [v.id, v]))

  const rows = entries.map((entry) => {
    const r = byNorm.get(normalizeOrgName(entry.companyName)) ?? null
    const v = viewById.get(entry.id)
    return buildFollowRow({
      entry,
      ranked: r,
      newOpenings: v?.newPostingCount ?? 0,
      openings: v?.visiblePostings.length ?? 0,
      layoffHref: `/layoffs/company/${employerSlug(entry.companyName, r?.company.name ?? null)}`,
    })
  })

  const c = data.candidate
  return {
    rows,
    suggestions: pickSuggestions(ranked, entries.map((e) => e.companyName), new Set(dismissed.map((d) => d.companyId))),
    profileThin: !c.metroArea || !c.primaryFunction || c.industries.length === 0,
  }
}
