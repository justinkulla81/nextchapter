import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Lock } from 'lucide-react'
import type { CompanyOwnershipType, CompanySizeBand } from '@prisma/client'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { HomeFold } from '@/components/candidate/HomeFold'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { SubmitButton } from '@/components/ui/submit-button'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  getCandidateMarketIntelTier,
  tierMeetsFeature,
  minTierForFeature,
  MARKET_INTEL_TIER_LABEL,
  type MarketIntelFeature,
} from '@/lib/market-intelligence/access'
import { computeCompBandWithMarketFallback } from '@/lib/market-intelligence/comp-bands'
import { memberMarketRole } from '@/lib/market/adzuna-insights'
import { AdzunaAttribution } from '@/components/market/AdzunaAttribution'
import {
  searchTargetCompanies,
  listAvailableTargetMetros,
  SIZE_BAND_LABEL,
  OWNERSHIP_LABEL,
  type TargetListFilters,
} from '@/lib/market-intelligence/target-list'
import { getDecisionMakerSignals } from '@/lib/market-intelligence/decision-makers'
import { getWarmPathCandidateContacts, matchWarmPathContacts } from '@/lib/market-intelligence/warm-paths'
import { getLatestWeeklyBrief } from '@/lib/market-intelligence/weekly-brief'
import { generateWeeklyBriefAction } from './actions'
import { SectionSkeleton } from '@/components/ui/section-skeleton'

export const metadata: Metadata = { title: 'Who is hiring and what it pays' }

const LINK = 'text-sm font-medium text-brand underline underline-offset-4'
const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95'
const SECONDARY = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'
const TRAJECTORIES = [
  { key: undefined, label: 'Any' },
  { key: 'growing', label: 'Growing' },
  { key: 'flat', label: 'Flat' },
  { key: 'contracting', label: 'Contracting' },
] as const

/** One line saying a feature needs a higher access level, with the level named. */
function LockRow({ feature, description }: { feature: MarketIntelFeature; description: string }) {
  const label = MARKET_INTEL_TIER_LABEL[minTierForFeature(feature)]
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-4 text-base text-ink">
      <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
      <span>{description}</span> <span className="text-sm text-muted-foreground">{label} only.</span>{' '}
      <Link href="/dashboard/alumni-plan" className={LINK}>See what unlocks it</Link>
    </p>
  )
}

/** The page's own address with the filters kept, one of them changed. */
function hrefWith(filters: TargetListFilters, change: Partial<TargetListFilters>) {
  const merged = { ...filters, ...change }
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) if (v) q.set(k, String(v))
  const qs = q.toString()
  return `/dashboard/market-intelligence${qs ? `?${qs}` : ''}`
}

export default async function MarketIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const profile = await getDashboardProfile()
  const tier = await getCandidateMarketIntelTier(profile.id)

  const canCompBands = tierMeetsFeature(tier, 'comp_bands')
  const canTargetList = tierMeetsFeature(tier, 'target_list_builder')
  const canDecisionMakers = tierMeetsFeature(tier, 'decision_maker_mapping')
  const canContactData = tierMeetsFeature(tier, 'contact_data')
  const canWeeklyBrief = tierMeetsFeature(tier, 'weekly_brief')

  captureServerEvent(profile.id, 'market_intelligence_page_viewed', { tier })

  const targetFunction = profile.targetFunction ?? profile.primaryFunction

  const filters: TargetListFilters = {
    trajectory: (sp.trajectory as TargetListFilters['trajectory']) || undefined,
    sizeBand: (sp.sizeBand as CompanySizeBand) || undefined,
    ownershipType: (sp.ownershipType as CompanyOwnershipType) || undefined,
    hqMetro: (sp.hqMetro as string) || undefined,
  }

  // Docs/candidate-redesign.md: one headline fact (the pay band, with where it comes from), the companies as rows that each say why,
  // and the filters, weekly brief and pointers folded away. A lower access level sees one-line locks instead of boxes.
  return (
    <div className="flex flex-col gap-6 pb-12">
      <PageHeader title="Who is hiring and what it pays" />

      {canCompBands ? (
        <Suspense fallback={<SectionSkeleton label="Loading your comp band…" />}>
          <CompBandBody targetFunction={targetFunction} profile={profile} />
        </Suspense>
      ) : (
        <LockRow feature="comp_bands" description="The real posted-salary range for your target, from our own posting data." />
      )}

      {canTargetList ? (
        <Suspense fallback={<SectionSkeleton label="Loading target companies…" lines={5} />}>
          <TargetListBody canDecisionMakers={canDecisionMakers} canContactData={canContactData} filters={filters} candidateId={profile.id} />
        </Suspense>
      ) : (
        <LockRow feature="target_list_builder" description="Companies filtered by hiring trend, size, ownership and metro, to build a real target list." />
      )}

      {canWeeklyBrief ? (
        <HomeFold title="Your weekly market brief" event="market_intel_brief_toggled">
          <Suspense fallback={<SectionSkeleton label="Loading your weekly brief…" />}>
            <WeeklyBriefBody candidateId={profile.id} />
          </Suspense>
        </HomeFold>
      ) : (
        <LockRow feature="weekly_brief" description="A weekly summary of openings, pay movement and warm paths at your target companies." />
      )}

      <HomeFold title="More ways to find the right people" event="market_intel_more_toggled">
        <ul className="space-y-2 text-base text-ink">
          <li>
            {tierMeetsFeature(tier, 'insider_network')
              ? 'Open any company page and tag where you have worked to see who else worked there and ask them a question.'
              : `Ask current and former employees at your target companies what the interview process is really like. Needs the ${MARKET_INTEL_TIER_LABEL[minTierForFeature('insider_network')]} level.`}
          </li>
          <li>
            Board and advisory openings are part of the Alumni plan.{' '}
            <Link href="/dashboard/find-my-job?types=part_time,contract,advisory#launch-phase-4" className={LINK}>See them on Interim work</Link>
          </li>
          <li className="text-sm text-muted-foreground">
            Warm paths come from your own contacts flagged HOT or WARM and members who opted in to the insider network, never a purchased list. Your access level:{' '}
            <span className="font-medium text-foreground">{MARKET_INTEL_TIER_LABEL[tier]}</span>.
          </li>
        </ul>
      </HomeFold>
    </div>
  )
}

type DashboardProfile = Awaited<ReturnType<typeof getDashboardProfile>>

async function CompBandBody({ targetFunction, profile }: { targetFunction: DashboardProfile['targetFunction']; profile: DashboardProfile }) {
  const compBand = await computeCompBandWithMarketFallback({ targetFunction, role: memberMarketRole(profile), state: profile.currentState })
  if (!compBand || !compBand.sufficientData || compBand.low === null || compBand.high === null) {
    return (
      <p className="rounded-2xl border border-border px-5 py-4 text-base text-muted-foreground">
        We cannot show a reliable pay band for your target yet
        {compBand && compBand.sampleSize > 0 ? `, with only ${compBand.sampleSize} posted salary range${compBand.sampleSize === 1 ? '' : 's'} on file` : ''}. It appears as more postings with salary data come in.
      </p>
    )
  }
  const range = `$${compBand.low.toLocaleString()}–$${compBand.high.toLocaleString()} base`
  const adzuna = compBand.source === 'adzuna'
  return (
    <section aria-labelledby="comp" className="space-y-1 rounded-2xl border border-border p-5">
      <h2 id="comp" className="font-display text-2xl font-semibold text-ink">
        {range} {adzuna ? `for ${compBand.adzunaRole}` : compBand.matchedOnFunction ? `for ${targetFunction}` : 'across comparable director+ roles'}
      </h2>
      <p className="text-base text-ink">
        <span className="font-semibold">Why:</span>{' '}
        {adzuna
          ? `that is the middle half of ${compBand.sampleSize.toLocaleString()} advertised salaries for this role in ${compBand.adzunaPlace}.`
          : `it comes from ${compBand.sampleSize} real posted salary range${compBand.sampleSize === 1 ? '' : 's'} on the NC Job Board.`}
      </p>
      {adzuna ? (
        <>
          <p className="text-sm text-muted-foreground">We did not have enough NC Job Board salary data for your target yet, so this comes from Adzuna.</p>
          <AdzunaAttribution surface="comp_band" />
        </>
      ) : (
        !compBand.matchedOnFunction && <p className="text-sm text-muted-foreground">There is not enough for your specific target function yet, so this is our broader director+ pool.</p>
      )}
    </section>
  )
}

async function WeeklyBriefBody({ candidateId }: { candidateId: string }) {
  const latestBrief = await getLatestWeeklyBrief(candidateId)
  return (
    <div className="flex flex-col gap-3">
      {latestBrief ? (
        <>
          <p className="text-xs text-muted-foreground">Week of {latestBrief.weekStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
          <p className="whitespace-pre-line text-base text-ink">{latestBrief.content}</p>
        </>
      ) : (
        <p className="text-base text-muted-foreground">No brief yet. Add companies to your watchlist and tag your work history for the richest one, then generate this week&apos;s.</p>
      )}
      <form action={generateWeeklyBriefAction} className="w-fit">
        <SubmitButton pendingLabel="Generating…" variant="outline" size="sm">
          Generate this week&apos;s brief
        </SubmitButton>
      </form>
    </div>
  )
}

const TRAJECTORY_VERDICT = { growing: 'Growing.', flat: 'Flat.', contracting: 'Contracting.' } as const
const TRAJECTORY_REASON = {
  growing: 'Our hiring signals show it growing.',
  flat: 'Our hiring signals show steady hiring.',
  contracting: 'Our hiring signals show fewer openings, so expect more competition.',
} as const

async function TargetListBody({
  canDecisionMakers,
  canContactData,
  filters,
  candidateId,
}: {
  canDecisionMakers: boolean
  canContactData: boolean
  filters: TargetListFilters
  candidateId: string
}) {
  // The metro list, the company search and the candidate's contact list are independent reads.
  const [availableMetros, targetCompanies, warmPathContacts] = await Promise.all([
    listAvailableTargetMetros(),
    searchTargetCompanies(filters, 20),
    canContactData ? getWarmPathCandidateContacts(candidateId) : Promise.resolve([]),
  ])
  // Decision-maker + warm-path enrichment only for the (already bounded to 20) companies actually rendered — never for the
  // full Company table. matchWarmPathContacts below is pure in-memory work.
  const enrichment =
    canDecisionMakers || canContactData
      ? await Promise.all(
          targetCompanies.map(async (c) => {
            const [decisionMakers, warmPaths] = await Promise.all([
              canDecisionMakers ? getDecisionMakerSignals(c.id, candidateId) : Promise.resolve([]),
              canContactData ? Promise.resolve(matchWarmPathContacts(warmPathContacts, c.name)) : Promise.resolve([]),
            ])
            return { companyId: c.id, decisionMakers, warmPaths }
          })
        )
      : []
  const enrichmentByCompany = new Map(enrichment.map((e) => [e.companyId, e]))
  const hasAnyFilter = !!(filters.trajectory || filters.sizeBand || filters.ownershipType || filters.hqMetro)
  const select = 'h-9 rounded-lg border border-input bg-transparent px-2 text-sm text-ink'
  return (
    <>
      <section aria-labelledby="targets" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="targets" className="font-display text-xl font-semibold text-ink">Companies worth a conversation</h2>
          <div role="group" aria-label="Hiring trend" className="flex flex-wrap gap-2">
            {TRAJECTORIES.map((t) => {
              const on = (filters.trajectory ?? undefined) === t.key
              return (
                <TrackedLink
                  key={t.label}
                  href={hrefWith(filters, { trajectory: t.key })}
                  event="market_intel_trend_filtered"
                  properties={{ trajectory: t.key ?? 'any' }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium ${on ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {t.label}
                </TrackedLink>
              )
            })}
          </div>
        </div>

        {targetCompanies.length === 0 ? (
          <p className="rounded-2xl border border-border p-4 text-base text-muted-foreground">
            No tracked company matches these filters yet. Try widening them{hasAnyFilter ? <>, or <Link href="/dashboard/market-intelligence" className={LINK}>clear them</Link></> : ''}.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {targetCompanies.map((c, i) => {
              const enriched = enrichmentByCompany.get(c.id)
              const warm = enriched?.warmPaths.length ?? 0
              const insiders = enriched?.decisionMakers.length ?? 0
              const trajectory = c.trajectory as keyof typeof TRAJECTORY_VERDICT | null
              const reasons = [
                trajectory ? TRAJECTORY_REASON[trajectory] : 'No hiring signal yet.',
                warm > 0 ? `${warm} ${warm === 1 ? 'person' : 'people'} in your network ${warm === 1 ? 'is' : 'are'} there.` : null,
                insiders > 0 ? `${insiders} current employee${insiders === 1 ? '' : 's'} in the insider network.` : null,
              ].filter(Boolean)
              const fact = [c.sizeBand ? SIZE_BAND_LABEL[c.sizeBand] : null, c.hqMetro, c.ownershipType ? OWNERSHIP_LABEL[c.ownershipType] : null].filter(Boolean).join(' · ')
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1 basis-72 space-y-0.5">
                    <p className="text-base font-semibold text-ink">{c.name}</p>
                    <p className="text-sm">
                      <span className={`font-semibold ${trajectory === 'growing' ? 'text-success' : 'text-muted-foreground'}`}>{trajectory ? TRAJECTORY_VERDICT[trajectory] : 'Unknown.'}</span> {reasons.join(' ')}
                    </p>
                    {fact && <p className="text-xs text-muted-foreground">{fact}</p>}
                  </div>
                  <TrackedLink
                    href={`/dashboard/companies/${encodeURIComponent(c.canonicalNameNormalized)}`}
                    event="market_intel_company_opened"
                    properties={{ companyId: c.id, trajectory: c.trajectory ?? 'none', warmPaths: warm, insiders, position: i + 1 }}
                    className={i === 0 ? PRIMARY : SECONDARY}
                  >
                    Open company
                  </TrackedLink>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <HomeFold title="More filters: size, ownership and metro" event="market_intel_filters_toggled">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {filters.trajectory && <input type="hidden" name="trajectory" value={filters.trajectory} />}
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Size
            <select name="sizeBand" defaultValue={filters.sizeBand ?? ''} className={select}>
              <option value="">Any</option>
              {Object.entries(SIZE_BAND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Ownership
            <select name="ownershipType" defaultValue={filters.ownershipType ?? ''} className={select}>
              <option value="">Any</option>
              {Object.entries(OWNERSHIP_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Metro
            <select name="hqMetro" defaultValue={filters.hqMetro ?? ''} className={select}>
              <option value="">Any</option>
              {availableMetros.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <SubmitButton pendingLabel="Filtering…" size="sm">Apply filters</SubmitButton>
          {hasAnyFilter && <Link href="/dashboard/market-intelligence" className="text-xs text-muted-foreground underline underline-offset-4">Clear filters</Link>}
        </form>
        <p className="text-xs text-muted-foreground">
          Ownership is confirmed by our team, not guessed. Companies without a confirmed private-equity or venture relationship show as Unknown.
        </p>
      </HomeFold>
    </>
  )
}
