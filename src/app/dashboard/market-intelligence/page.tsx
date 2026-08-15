import type { Metadata } from 'next'
import Link from 'next/link'
import { Lock, TrendingUp, TrendingDown, Minus, Users, DollarSign, Building2, Sparkles, Mail } from 'lucide-react'
import type { CompanyOwnershipType, CompanySizeBand } from '@prisma/client'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SubmitButton } from '@/components/ui/submit-button'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  getCandidateMarketIntelTier,
  tierMeetsFeature,
  minTierForFeature,
  MARKET_INTEL_TIER_LABEL,
  type MarketIntelFeature,
} from '@/lib/market-intelligence/access'
import { computeCompBandForTarget } from '@/lib/market-intelligence/comp-bands'
import {
  searchTargetCompanies,
  listAvailableTargetMetros,
  SIZE_BAND_LABEL,
  OWNERSHIP_LABEL,
  type TargetListFilters,
} from '@/lib/market-intelligence/target-list'
import { getDecisionMakerSignals } from '@/lib/market-intelligence/decision-makers'
import { getWarmPathContactsForCompany } from '@/lib/market-intelligence/warm-paths'
import { getLatestWeeklyBrief } from '@/lib/market-intelligence/weekly-brief'
import { generateWeeklyBriefAction } from './actions'

export const metadata: Metadata = { title: 'Market Intelligence' }

const TRAJECTORY_ICON = { growing: TrendingUp, contracting: TrendingDown, flat: Minus } as const

function LockedFeature({ feature, description }: { feature: MarketIntelFeature; description: string }) {
  const label = MARKET_INTEL_TIER_LABEL[minTierForFeature(feature)]
  return (
    <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-orange" aria-hidden="true" />
        <p className="text-sm font-medium text-orange">{label} only</p>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default async function MarketIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const profile = await getDashboardData()
  const tier = await getCandidateMarketIntelTier(profile.id)

  const canCompBands = tierMeetsFeature(tier, 'comp_bands')
  const canInsiderNetwork = tierMeetsFeature(tier, 'insider_network')
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
  const hasAnyFilter = !!(filters.trajectory || filters.sizeBand || filters.ownershipType || filters.hqMetro)

  const [compBand, availableMetros, targetCompanies, latestBrief] = await Promise.all([
    canCompBands ? computeCompBandForTarget(targetFunction) : Promise.resolve(null),
    canTargetList ? listAvailableTargetMetros() : Promise.resolve([]),
    canTargetList ? searchTargetCompanies(filters, 20) : Promise.resolve([]),
    canWeeklyBrief ? getLatestWeeklyBrief(profile.id) : Promise.resolve(null),
  ])

  // Decision-maker + warm-path enrichment only for the (already bounded to
  // 20) companies actually rendered — never for the full Company table.
  const enrichment =
    canTargetList && (canDecisionMakers || canContactData)
      ? await Promise.all(
          targetCompanies.map(async (c) => ({
            companyId: c.id,
            decisionMakers: canDecisionMakers ? await getDecisionMakerSignals(c.id, profile.id) : [],
            warmPaths: canContactData ? await getWarmPathContactsForCompany(profile.id, c.name) : [],
          }))
        )
      : []
  const enrichmentByCompany = new Map(enrichment.map((e) => [e.companyId, e]))

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Market Intelligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who&apos;s hiring at your level, who to talk to, and what it pays — built from real NextChapter data, not a
          resold data license.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Your current access level: <span className="font-medium text-foreground">{MARKET_INTEL_TIER_LABEL[tier]}</span>
        </p>
      </div>

      {/* ── Comp bands ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-4" aria-hidden="true" />
            Comp band for your target
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canCompBands ? (
            <LockedFeature
              feature="comp_bands"
              description="See the real posted-salary range for your target function, computed from our own posting data."
            />
          ) : !compBand || !compBand.sufficientData || compBand.low === null || compBand.high === null ? (
            <p className="text-sm text-muted-foreground">
              Insufficient data to show a reliable comp band right now
              {compBand && compBand.sampleSize > 0 ? ` (only ${compBand.sampleSize} posted salary range${compBand.sampleSize === 1 ? '' : 's'} on file)` : ''}.
              Check back as more postings with salary data come in.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-medium">
                  ${compBand.low.toLocaleString()}–${compBand.high.toLocaleString()} base
                </span>{' '}
                {compBand.matchedOnFunction ? `for ${targetFunction}` : 'across comparable director+ roles'}.
              </p>
              <p className="text-xs text-muted-foreground">
                Based on {compBand.sampleSize} real posted salary range{compBand.sampleSize === 1 ? '' : 's'} on the NC Job Board
                {compBand.matchedOnFunction ? '' : " — not enough of your specific target function yet, so this is our broader director+ pool"}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Insider network ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            Insider network
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canInsiderNetwork ? (
            <LockedFeature
              feature="insider_network"
              description="Ask real current and former employees at companies you're targeting what the interview process is really like."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Open any company page and tag where you&apos;ve worked to see who else has worked there and ask them a
              question.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Weekly brief ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden="true" />
            Your weekly market brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canWeeklyBrief ? (
            <LockedFeature
              feature="weekly_brief"
              description="A generated weekly summary of openings, comp movement, and warm paths at the companies you're targeting."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {latestBrief ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Week of {latestBrief.weekStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">{latestBrief.content}</p>
                </div>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="No brief generated yet"
                  description="Add companies to your watchlist and tag your work history for the richest brief, then generate this week's."
                />
              )}
              <form action={generateWeeklyBriefAction} className="w-fit">
                <SubmitButton pendingLabel="Generating…" variant="outline" size="sm">
                  Generate this week&apos;s brief
                </SubmitButton>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Target list builder ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" aria-hidden="true" />
            Target list builder
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canTargetList ? (
            <LockedFeature
              feature="target_list_builder"
              description="Filter companies by hiring trajectory, size, ownership, and geography to build a real target list."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="trajectory" className="text-xs font-medium text-muted-foreground">
                    Trajectory
                  </label>
                  <select id="trajectory" name="trajectory" defaultValue={filters.trajectory ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="">Any</option>
                    <option value="growing">Growing</option>
                    <option value="flat">Flat</option>
                    <option value="contracting">Contracting</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="sizeBand" className="text-xs font-medium text-muted-foreground">
                    Size
                  </label>
                  <select id="sizeBand" name="sizeBand" defaultValue={filters.sizeBand ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="">Any</option>
                    {Object.entries(SIZE_BAND_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ownershipType" className="text-xs font-medium text-muted-foreground">
                    Ownership
                  </label>
                  <select id="ownershipType" name="ownershipType" defaultValue={filters.ownershipType ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="">Any</option>
                    {Object.entries(OWNERSHIP_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="hqMetro" className="text-xs font-medium text-muted-foreground">
                    Metro
                  </label>
                  <select id="hqMetro" name="hqMetro" defaultValue={filters.hqMetro ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="">Any</option>
                    {availableMetros.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton pendingLabel="Filtering…" size="sm">
                  Apply filters
                </SubmitButton>
                {hasAnyFilter && (
                  <Link href="/dashboard/market-intelligence" className="text-xs text-muted-foreground underline underline-offset-4">
                    Clear filters
                  </Link>
                )}
              </form>

              <p className="text-xs text-muted-foreground">
                Ownership is admin-confirmed only, not automatically detected — companies without a confirmed PE/VC
                relationship on file show as Unknown rather than being guessed.
              </p>

              {targetCompanies.length === 0 ? (
                <EmptyState icon={Building2} title="No matching companies" description="Try widening your filters, or none of our tracked companies match yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Company</th>
                        <th className="py-2 pr-3">Trajectory</th>
                        <th className="py-2 pr-3">Size</th>
                        <th className="py-2 pr-3">Ownership</th>
                        <th className="py-2 pr-3">Metro</th>
                        {canDecisionMakers && <th className="py-2 pr-3">Decision-makers</th>}
                        {canContactData && <th className="py-2 pr-3">Warm paths</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {targetCompanies.map((c) => {
                        const Icon = c.trajectory ? TRAJECTORY_ICON[c.trajectory as keyof typeof TRAJECTORY_ICON] : Minus
                        const enriched = enrichmentByCompany.get(c.id)
                        return (
                          <tr key={c.id} className="border-b border-border/60">
                            <td className="py-2 pr-3">
                              <Link href={`/dashboard/companies/${c.id}`} className="font-medium text-primary underline underline-offset-4">
                                {c.name}
                              </Link>
                            </td>
                            <td className="py-2 pr-3">
                              {c.trajectory ? (
                                <span className="flex items-center gap-1">
                                  <Icon className="size-3.5" aria-hidden="true" />
                                  {c.trajectory}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No signal yet</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">{c.sizeBand ? SIZE_BAND_LABEL[c.sizeBand] : <span className="text-muted-foreground">Unknown</span>}</td>
                            <td className="py-2 pr-3">
                              {c.ownershipType ? OWNERSHIP_LABEL[c.ownershipType] : <span className="text-muted-foreground">Unknown</span>}
                            </td>
                            <td className="py-2 pr-3">{c.hqMetro ?? <span className="text-muted-foreground">Unknown</span>}</td>
                            {canDecisionMakers && (
                              <td className="py-2 pr-3">
                                {enriched && enriched.decisionMakers.length > 0
                                  ? `${enriched.decisionMakers.length} current employee insider${enriched.decisionMakers.length === 1 ? '' : 's'}`
                                  : '—'}
                              </td>
                            )}
                            {canContactData && (
                              <td className="py-2 pr-3">
                                {enriched && enriched.warmPaths.length > 0 ? `${enriched.warmPaths.length} in your network` : '—'}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Contact data (licensed vendor gap) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" aria-hidden="true" />
            Contact data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canContactData ? (
            <LockedFeature
              feature="contact_data"
              description="Warm-path contacts from your own network and the insider network at companies you're targeting."
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                &ldquo;Warm paths&rdquo; above come from your own network (Support Network contacts flagged as HOT or
                WARM) and current employees who&apos;ve opted in to the insider network — real people you or another
                member already know, never a purchased list.
              </p>
              <EmptyState
                icon={Mail}
                title="No data provider connected"
                description="Contact records beyond your own network — direct emails, phone numbers, verified titles for people you don't already know — require a licensed data provider (e.g. Apollo, Clearbit). None is connected yet."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Board & advisory ── */}
      <Card>
        <CardHeader>
          <CardTitle>Board &amp; advisory opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Board and advisory listings are part of NextChapter Membership rather than gated here — see them on your{' '}
            <Link href="/dashboard/interim-work#launch-phase-4" className="text-primary underline underline-offset-4">
              Interim Work page
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
