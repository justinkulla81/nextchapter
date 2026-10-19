import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { TrendingUp, TrendingDown, Minus, Users, TriangleAlert, Check } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SIZE_BAND_LABEL } from '@/components/companies/CompanyMetaLine'
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
import { rankCompanies, type CompanyRanking, type FitBand } from '@/lib/companies/company-ranking'
import { CompanyDirectoryViewed, RankedCompanyLink } from '@/components/companies/CompanyDirectoryAnalytics'
import { FeedbackRequests } from '@/components/companies/FeedbackRequests'
import { AiPayPremiumCard } from '@/components/companies/AiPayPremiumCard'
import { loadAiPayPremium } from '@/lib/market/ai-pay-premium-data'
import { SectionSkeleton } from '@/components/ui/section-skeleton'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { CompaniesRedesign } from '@/components/companies/CompaniesRedesign'

export const metadata: Metadata = { title: 'Companies' }

const BAND_LABEL: Record<FitBand, string> = {
  strong: 'Strong fit',
  worth_a_look: 'Worth a look',
  long_shot: 'Long shot',
}
const BAND_STYLE: Record<FitBand, string> = {
  strong: 'bg-success/10 text-success',
  worth_a_look: 'bg-muted text-foreground',
  long_shot: 'bg-muted text-muted-foreground',
}

const PAGE_SIZE = 25
// A signal older than this doesn't say much about "right now" — same
// recency bar as the "Available jobs" and "Exclude contracting" filters use.
const RECENT_SIGNAL_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000 // 8 weeks

const TRAJECTORY_ICON = { growing: TrendingUp, flat: Minus, contracting: TrendingDown } as const
const TRAJECTORY_LABEL: Record<string, string> = { growing: 'Growing', flat: 'Flat', contracting: 'Contracting' }
const TRAJECTORY_COLOR: Record<string, string> = {
  growing: 'text-success',
  flat: 'text-muted-foreground',
  contracting: 'text-destructive',
}

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

// The title, intro and sort toggle need no data, so they paint straight away
// and the same markup is reused once the ranked directory has loaded.
function CompaniesHeading({ params, children }: { params: SearchParams; children?: React.ReactNode }) {
  const sort = sortFromParams(params)
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
      <p className="text-muted-foreground">
        {sort === 'fit'
          ? 'Ranked for you: who is hiring, who is cutting, how close they are, and who you know. Every company shows why it landed where it did.'
          : 'Hiring signal, who to talk to, and how members have fared — for any company you’re targeting.'}
      </p>
      <div className="flex items-center gap-2 pt-1" role="group" aria-label="Sort companies">
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/companies?${buildQuery(params, { sort: undefined, page: undefined })}`} />}
          variant={sort === 'fit' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={sort === 'fit'}
        >
          Best fit for me
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/companies?${buildQuery(params, { sort: 'az', page: undefined })}`} />}
          variant={sort === 'az' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={sort === 'az'}
        >
          A–Z
        </Button>
      </div>
      {children}
    </div>
  )
}

export default async function CompaniesIndexPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const profile = await getDashboardProfile()
  const redesign = isRedesignOn(profile.email)
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          {redesign ? <PageHeader title="Companies" intro="Companies worth a look, with the reason for each." /> : <CompaniesHeading params={params} />}
          <SectionSkeleton label="Loading companies…" lines={6} />
        </div>
      }
    >
      <CompaniesDirectory params={params} profile={profile} redesign={redesign} />
    </Suspense>
  )
}

async function CompaniesDirectory({ params, profile, redesign }: { params: SearchParams; profile: DashboardProfile; redesign: boolean }) {
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

  if (redesign) {
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

  return (
    <div className="space-y-6">
      <CompanyDirectoryViewed
        sort={sort}
        resultCount={totalCount}
        page={page}
        hasFilters={filterJobs || filterNc1 || filterNc2 || filterMine || filterNoContracting || filterStrong}
        hasQuery={!!query}
      />
      <CompaniesHeading params={params}>
        {localEconomy && (
          <p className="text-sm text-muted-foreground">
            {[
              localEconomy.metro && localEconomy.metroLayoffEvents90d > 0
                ? `${localEconomy.metro}: ${localEconomy.metroLayoffEvents90d} layoff ${localEconomy.metroLayoffEvents90d === 1 ? 'notice' : 'notices'}${localEconomy.metroLayoffWorkers90d > 0 ? ` (${localEconomy.metroLayoffWorkers90d.toLocaleString()} workers)` : ''} in the last 90 days`
                : null,
              localEconomy.unemploymentRate !== null
                ? `${localEconomy.stateName} unemployment ${localEconomy.unemploymentRate}%${
                    localEconomy.unemploymentChange !== null && localEconomy.unemploymentChange !== 0
                      ? `, ${localEconomy.unemploymentChange > 0 ? 'up' : 'down'} ${Math.abs(localEconomy.unemploymentChange)} from a year ago`
                      : ''
                  }`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {localEconomy.stress > 0 && ' — your local market is under strain, so local roles draw more competition.'}
          </p>
        )}
        {newStrongIds.size > 0 && (
          <p className="text-sm font-medium text-foreground">
            {newStrongIds.size} new strong {newStrongIds.size === 1 ? 'signal' : 'signals'} since your last visit.
          </p>
        )}
        {sort === 'fit' && rankingCandidateIncomplete && (
          <p className="text-sm text-muted-foreground">
            Rankings get sharper with your location, function and target industries.{' '}
            <Link href="/dashboard/search-strategy" className="underline underline-offset-2">
              Update your search strategy
            </Link>
            .
          </p>
        )}
      </CompaniesHeading>

      <FeedbackRequests candidateId={profile.id} />
      {aiPay && <AiPayPremiumCard row={aiPay} functionName={aiPay.function} />}

      <form className="space-y-3">
        {sort === 'az' && <input type="hidden" name="sort" value="az" />}
        <Input name="q" defaultValue={query} placeholder="Search companies…" className="max-w-sm" />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {filterCheckboxes.map(({ key, label, checked }) => (
            <div key={key} className="flex items-center gap-2">
              {/* Plain native input, not the design system's Checkbox — this
                  is a no-JS GET form (query params on submit), and a native
                  checkbox is the one guaranteed-correct way to get that
                  submission behavior without depending on how a headless
                  component's hidden input forwards `value`. */}
              <input
                type="checkbox"
                id={key}
                name={key}
                value="1"
                defaultChecked={checked}
                className="size-4 rounded border-input"
              />
              <Label htmlFor={key} className="text-sm font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Hide contracting&quot; reads posting-activity trends only. Filed layoff notices don&apos;t hide a company
          here — in Best fit they lower its rank and show as a warning on the row.
        </p>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>

      {companies.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {query || filterJobs || filterNc1 || filterNc2 || filterMine || filterNoContracting || filterStrong
            ? 'No companies match your search and filters.'
            : 'No companies yet.'}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {companies.map((company) => {
            const signal = company.signals[0]
            const Icon = signal ? TRAJECTORY_ICON[signal.trajectory as keyof typeof TRAJECTORY_ICON] : null
            const myContactCount = contactCountsByCompany.get(company.name) ?? 0
            const ranked = rankingById.get(company.id)
            return (
              <RankedCompanyLink
                key={company.id}
                href={`/dashboard/companies/${encodeURIComponent(company.canonicalNameNormalized)}`}
                companyId={company.id}
                rank={ranked?.rank ?? null}
                band={ranked?.ranking.band ?? null}
                sort={sort}
                className="flex items-start justify-between gap-4 p-4 hover:bg-muted/50"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium text-foreground">
                    {ranked && <span className="mr-2 tabular-nums text-muted-foreground">#{ranked.rank}</span>}
                    {company.name}
                    {newStrongIds.has(company.id) && (
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 align-middle text-xs font-medium text-brand">
                        New
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[company.industry, company.sizeBand ? SIZE_BAND_LABEL[company.sizeBand] : null, company.hqMetro]
                      .filter(Boolean)
                      .join(' · ') || 'Details still filling in'}
                  </p>
                  {ranked && ranked.ranking.reasons.length > 0 && (
                    <ul className="space-y-0.5 text-sm text-foreground">
                      {ranked.ranking.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {ranked && ranked.ranking.cautions.length > 0 && (
                    <ul className="space-y-0.5 text-sm text-muted-foreground">
                      {ranked.ranking.cautions.map((caution) => (
                        <li key={caution} className="flex items-start gap-1.5">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span>{caution}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-sm">
                  {ranked && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BAND_STYLE[ranked.ranking.band]}`}>
                      {BAND_LABEL[ranked.ranking.band]}
                    </span>
                  )}
                  {myContactCount > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3.5" aria-hidden="true" />
                      {myContactCount} your contact{myContactCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {company._count.memberEmployment > 0 && (
                    <span className="text-muted-foreground">
                      {company._count.memberEmployment} NextChapter member{company._count.memberEmployment === 1 ? '' : 's'}
                    </span>
                  )}
                  {signal && Icon && (
                    <span className={`flex items-center gap-1 font-medium ${TRAJECTORY_COLOR[signal.trajectory]}`}>
                      <Icon className="size-4" aria-hidden />
                      {TRAJECTORY_LABEL[signal.trajectory]}
                    </span>
                  )}
                </div>
              </RankedCompanyLink>
            )
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(totalCount, page * PAGE_SIZE)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Button
                nativeButton={false}
                render={<Link href={`/dashboard/companies?${buildQuery(params, { page: String(page - 1) })}`} />}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
            )}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && (
              <Button
                nativeButton={false}
                render={<Link href={`/dashboard/companies?${buildQuery(params, { page: String(page + 1) })}`} />}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
