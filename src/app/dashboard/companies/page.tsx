import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import {
  getCandidateContactCountsByCompany,
  getCompaniesWithAnyMemberContact,
} from '@/lib/companies/candidate-contacts-at-company'
import { loadCompanyRankingData } from '@/lib/companies/company-ranking-data'
import {
  COMPANIES_VISIT_SESSION_MS,
  getLastCompaniesVisit,
  newStrongIdsFromRankingData,
} from '@/lib/companies/new-strong-companies'
import type { LocalEconomy } from '@/lib/companies/local-economy'
import { loadDirectoryPage, loadDirectoryRows } from '@/lib/companies/directory-rows'
import { rankCompanies, type CompanyRanking } from '@/lib/companies/company-ranking'
import { FeedbackRequests } from '@/components/companies/FeedbackRequests'
import { AiPayPremiumCard } from '@/components/companies/AiPayPremiumCard'
import { loadAiPayPremium } from '@/lib/market/ai-pay-premium-data'
import { SectionSkeleton } from '@/components/ui/section-skeleton'
import { PageHeader } from '@/components/candidate/PageHeader'
import { CompaniesRedesign } from '@/components/companies/CompaniesRedesign'

export const metadata: Metadata = { title: 'Companies' }

const PAGE_SIZE = 25
// A signal older than this doesn't say much about "right now" — same
// recency bar as the "Available jobs" and "Exclude contracting" filters use.
const RECENT_SIGNAL_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000 // 8 weeks

interface SearchParams {
  q?: string
  page?: string
  jobs?: string
  nc1?: string
  nc2?: string
  mine?: string
  noContracting?: string
  strong?: string
  sort?: string
}

// Module-level helper, not called inline inside the component body —
// Date.now() is an impure call the react-hooks/purity rule flags wherever a
// component function reads it directly.
function recentSignalCutoff(): number {
  return Date.now() - RECENT_SIGNAL_WINDOW_MS
}

function buildQuery(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides }
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value)
  }
  return usp.toString()
}

type DashboardProfile = Awaited<ReturnType<typeof getDashboardProfile>>

function sortFromParams(params: SearchParams): 'fit' | 'az' {
  return params.sort === 'az' ? 'az' : 'fit'
}

export default async function CompaniesIndexPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const profile = await getDashboardProfile()
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader title="Companies" intro="Companies worth a look, with the reason for each." />
          <SectionSkeleton label="Loading companies…" lines={6} />
        </div>
      }
    >
      <CompaniesDirectory params={params} profile={profile} />
    </Suspense>
  )
}

async function CompaniesDirectory({ params, profile }: { params: SearchParams; profile: DashboardProfile }) {
  const query = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const filterJobs = params.jobs === '1'
  const filterNc1 = params.nc1 === '1'
  const filterNc2 = params.nc2 === '1'
  const filterMine = params.mine === '1'
  const filterNoContracting = params.noContracting === '1'
  const filterStrong = params.strong === '1'
  // "Best fit" is the default: this page is research for a job search, and an
  // alphabetical list of every company in the system answers no question a
  // searcher actually has. A–Z stays one click away for looking up a name.
  const sort = sortFromParams(params)

  // Ranking is needed for the Best fit order and for the "Strong signals only"
  // filter; plain A–Z lookups skip it (it is a handful of bulk reads).
  const needsRanking = sort === 'fit' || filterStrong
  // Start the independent loads together: the ranking data, the visit marker
  // (one session window back, so re-rendering this page — filter, paging —
  // doesn't erase the "New" tags the visit started with) and the AI pay row
  // don't depend on the company list.
  const rankingPromise = needsRanking ? loadCompanyRankingData(profile.id) : null
  const lastVisitPromise = needsRanking
    ? getLastCompaniesVisit(profile.id, COMPANIES_VISIT_SESSION_MS)
    : Promise.resolve(null)
  const aiPayPromise = profile.primaryFunction ? loadAiPayPremium() : Promise.resolve(null)

  const nameWhere = query ? { name: { contains: query, mode: 'insensitive' as const } } : {}
  const anyFilter = filterJobs || filterNc1 || filterNc2 || filterMine || filterNoContracting || filterStrong

  // Plain A–Z with no filters needs no signals, ranking or full list: the
  // database counts and pages it, and only the visible rows' contact counts
  // are looked up. Anything else filters/ranks the whole list in memory
  // (signals live on a weekly-snapshot table and the viewer's contacts are
  // per-user); its viewer-independent inputs come from short in-process caches
  // in directory-rows.ts.
  const pagedInDatabase = !needsRanking && !anyFilter
  const allCompanies = pagedInDatabase ? [] : await loadDirectoryRows(nameWhere, true)
  const dbPage = pagedInDatabase ? await loadDirectoryPage(nameWhere, (page - 1) * PAGE_SIZE, PAGE_SIZE) : null

  const companyNames = dbPage ? dbPage.rows.map((c) => c.name) : allCompanies.map((c) => c.name)
  const recentCutoff = recentSignalCutoff()

  // Always computed (the member's contacts are loaded once per request and
  // shared with the ranking) since it powers both the "Your connections"
  // filter and the per-row contact count everyone sees.
  const [contactCountsByCompany, membersWithContact] = await Promise.all([
    getCandidateContactCountsByCompany(profile.id, companyNames),
    // Only fetched when the filter is actually on — a full contacts-table
    // scan isn't worth it for a filter most visits won't use.
    filterNc2 ? getCompaniesWithAnyMemberContact(profile.id, companyNames) : Promise.resolve(new Set<string>()),
  ])

  const filtered = allCompanies.filter((company) => {
    const signal = company.signals[0]
    const signalIsRecent = signal && signal.weekStartDate.getTime() >= recentCutoff
    if (filterJobs && !(signalIsRecent && signal.openRolesTotal > 0)) return false
    if (filterNoContracting && signalIsRecent && signal.trajectory === 'contracting') return false
    if (filterNc1 && company._count.memberEmployment === 0) return false
    if (filterNc2 && !membersWithContact.has(company.name)) return false
    if (filterMine && !contactCountsByCompany.has(company.name)) return false
    return true
  })

  const aiPay = ((await aiPayPromise) ?? []).find((r) => r.function === profile.primaryFunction) ?? null
  const rankingById = new Map<string, { rank: number; ranking: CompanyRanking }>()
  let newStrongIds = new Set<string>()
  let localEconomy: LocalEconomy | null = null
  let ordered = filtered
  let rankingCandidateIncomplete = false
  if (rankingPromise) {
    const [{ candidate, companies: rankable, localEconomy: economy }, lastVisit] = await Promise.all([
      rankingPromise,
      lastVisitPromise,
    ])
    localEconomy = economy
    rankingCandidateIncomplete = !candidate.metroArea || !candidate.primaryFunction || candidate.industries.length === 0
    const keep = new Set(filtered.map((c) => c.id))
    rankCompanies(
      rankable.filter((c) => keep.has(c.id)),
      candidate
    ).forEach((r, i) => rankingById.set(r.company.id, { rank: i + 1, ranking: r.ranking }))
    if (sort === 'fit') {
      ordered = [...filtered].sort((a, b) => (rankingById.get(a.id)?.rank ?? 0) - (rankingById.get(b.id)?.rank ?? 0))
    }
    if (filterStrong) ordered = ordered.filter((c) => rankingById.get(c.id)?.ranking.band === 'strong')
    // Same ranking input as above (contacts neutralised), not a second load.
    if (lastVisit) newStrongIds = newStrongIdsFromRankingData(rankable, candidate, lastVisit)
  }

  const totalCount = dbPage ? dbPage.total : ordered.length
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const companies = dbPage ? dbPage.rows : ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const filterCheckboxes: { key: keyof SearchParams; label: string; checked: boolean }[] = [
    { key: 'jobs', label: 'Has open roles', checked: filterJobs },
    { key: 'nc1', label: 'NC members worked here', checked: filterNc1 },
    { key: 'nc2', label: 'NC members have a contact here', checked: filterNc2 },
    { key: 'mine', label: 'You have a contact here', checked: filterMine },
    { key: 'noContracting', label: 'Hide contracting companies', checked: filterNoContracting },
    { key: 'strong', label: 'Strong signals only', checked: filterStrong },
  ]

  const economyLine = localEconomy
    ? [
        localEconomy.metro && localEconomy.metroLayoffEvents90d > 0
          ? `${localEconomy.metro}: ${localEconomy.metroLayoffEvents90d} layoff ${localEconomy.metroLayoffEvents90d === 1 ? 'notice' : 'notices'} in the last 90 days`
          : null,
        localEconomy.unemploymentRate !== null ? `${localEconomy.stateName} unemployment ${localEconomy.unemploymentRate}%` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  return (
    <CompaniesRedesign
      rows={companies.map((company) => {
        const ranked = rankingById.get(company.id)
        return {
          id: company.id,
          name: company.name,
          canonicalNameNormalized: company.canonicalNameNormalized,
          industry: company.industry,
          hqMetro: company.hqMetro,
          openRoles: company.signals[0]?.openRolesTotal ?? 0,
          contacts: contactCountsByCompany.get(company.name) ?? 0,
          rank: ranked?.rank ?? null,
          band: ranked?.ranking.band ?? null,
          ranking: ranked ? { reasons: ranked.ranking.reasons, cautions: ranked.ranking.cautions } : null,
        }
      })}
      query={query}
      sort={sort}
      filters={filterCheckboxes}
      anyFilter={filterJobs || filterNc1 || filterNc2 || filterMine || filterNoContracting || filterStrong}
      page={page}
      pageCount={pageCount}
      pageSize={PAGE_SIZE}
      totalCount={totalCount}
      newStrongCount={newStrongIds.size}
      buildHref={(overrides) => buildQuery(params, overrides)}
      more={
        <>
          {economyLine && (
            <p className="text-sm text-muted-foreground">
              {economyLine}
              {localEconomy && localEconomy.stress > 0 && '. Your local market is under strain, so local roles draw more competition.'}
            </p>
          )}
          {sort === 'fit' && rankingCandidateIncomplete && (
            <p className="text-sm text-muted-foreground">
              Rankings get sharper with your location, function and target industries.{' '}
              <Link href="/dashboard/improve" className="font-medium text-brand underline underline-offset-4">
                Improve your search
              </Link>
              .
            </p>
          )}
          <FeedbackRequests candidateId={profile.id} />
          {aiPay && <AiPayPremiumCard row={aiPay} functionName={aiPay.function} />}
        </>
      }
    />
  )
}
