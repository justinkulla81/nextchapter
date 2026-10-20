import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Building2, TrendingUp, TrendingDown, Minus, Users, Lock, MessageSquare, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { CompanyMetaLine, CompanyMetaLineSkeleton } from '@/components/companies/CompanyMetaLine'
import { ShowMoreList } from '@/components/dashboard/ShowMoreList'
import {
  hasTaggedEmployment,
  getInsidersForCompany,
  getInsiderRequestsForAsker,
  getPendingInsiderRequestsForInsider,
  type InsiderSummary,
} from '@/lib/companies/insider-network'
import { autoTagAllWorkHistory } from '@/lib/companies/employment-tagging'
import {
  getCandidateContactsAtCompany,
  countOtherMembersWithContactAtCompany,
  getSecondDegreeContactsAtCompany,
} from '@/lib/companies/candidate-contacts-at-company'
import { getPublishedIntelForCompany, INTEL_TYPE_LABEL, type IntelType } from '@/lib/companies/company-intel'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { suppressSmallCells, isSuppressedCell } from '@/lib/admin/cell-suppression'
import { captureServerEvent } from '@/lib/posthog/server'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { EmptyNote, FactList, PlainNote, SectionBlock, SourceLine } from '@/components/candidate/Blocks'
import { hiringSignalText } from '@/lib/redesign/jobs-pages'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { ManualTagForm, CurrentEmployerInsiderOptIn } from '@/components/companies/EmploymentTagging'
import { AskInsiderForm, AnswerInsiderRequestForm } from '@/components/companies/InsiderNetworkControls'
import { ContactEmploymentStatusButtons } from '@/components/companies/ContactEmploymentStatusButtons'
import { SubmitIntelForm, MarkHelpfulButton } from '@/components/companies/CompanyIntelControls'
import { getCandidateMarketIntelTier, tierMeetsFeature, MARKET_INTEL_TIER_LABEL } from '@/lib/market-intelligence/access'
import { getRecruitingFirmData } from '@/lib/companies/recruiting-firm'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'
import { Briefcase } from 'lucide-react'
import { toCandidateCompany } from '@/lib/companies/candidate-view'
import { CompanyIntelPanels } from '@/components/companies/CompanyIntelPanels'
import { CompanyHowToRedesign } from '@/components/companies/CompanyHowToRedesign'
import { CompanyHiringIndex, CompanyHiringIndexSkeleton } from '@/components/companies/CompanyHiringIndex'
import { getCultureProfile, getCultureSurveyCompanies } from '@/lib/companies/culture-profile'
import { CultureProfileBars, CultureSurveyOwnEntry } from '@/components/companies/CultureSurvey'
import { ReviewSummaryPanel } from '@/components/companies/ReviewSummaryPanel'
import { getCompanyReviewSummary } from '@/lib/job-reviews/data'
import { SectionSkeleton } from '@/components/ui/section-skeleton'
import { findTopEmployer, knownForLabel, topEmployerSourceLine } from '@/lib/companies/top-employers'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const company = await prisma.company.findUnique({
    where: { canonicalNameNormalized: decodeURIComponent(slug) },
    select: { name: true },
  })
  return { title: company ? company.name : 'Company' }
}

// The culture aggregate and review summary are the slowest reads on this page
// and nothing else depends on them, so they stream in behind the card.
async function CompanyCultureSection({
  companyId: id,
  companyName,
  slug,
  candidateId,
  redesign = false,
}: {
  companyId: string
  companyName: string
  slug: string
  candidateId: string
  redesign?: boolean
}) {
  const [cultureProfile, ownCultureCompanies, reviewSummary] = await Promise.all([
    // Aggregate only, viewer's own answer excluded (see culture-aggregate.ts).
    getCultureProfile(id, candidateId),
    getCultureSurveyCompanies(candidateId),
    getCompanyReviewSummary(id, candidateId),
  ])
  const ownCulture = ownCultureCompanies.find((c) => c.companyId === id) ?? null
  if (redesign) {
    return (
      <div className="space-y-6">
        <CultureProfileBars profile={cultureProfile} redesign />
        {ownCulture && (
          <CultureSurveyOwnEntry
            companyId={id}
            companyName={companyName}
            companySlug={slug}
            initial={ownCulture.answers}
            isCurrent={ownCulture.isCurrent}
            redesign
          />
        )}
        <div className="space-y-2">
          <h3 className="font-display text-lg font-semibold text-ink">Ratings and reviews</h3>
          <ReviewSummaryPanel summary={reviewSummary} canReview={ownCulture !== null} redesign />
        </div>
        {cultureProfile.shown && (
          <SourceLine>
            Want specifics? Ask one of them directly in{' '}
            <a href="#insiders" className="font-medium text-brand underline underline-offset-4">
              Members who know this company
            </a>
            .
          </SourceLine>
        )}
      </div>
    )
  }
  return (
    <>
      <CultureProfileBars profile={cultureProfile} />
      {ownCulture && (
        <CultureSurveyOwnEntry
          companyId={id}
          companyName={companyName}
          companySlug={slug}
          initial={ownCulture.answers}
          isCurrent={ownCulture.isCurrent}
        />
      )}
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Ratings and reviews</h3>
        <ReviewSummaryPanel summary={reviewSummary} canReview={ownCulture !== null} />
      </div>
      {cultureProfile.shown && (
        <p className="text-xs text-muted-foreground">
          Want specifics? Ask one of them directly in <a href="#insiders" className="text-primary underline underline-offset-4">People who know this company</a>.
        </p>
      )}
    </>
  )
}

const TENURE_LABEL: Record<string, string> = {
  current: 'A current employee',
  within_2yrs: 'left within 2 years',
  '2_5yrs': 'left 2-5 years ago',
  '5yrs_plus': 'left 5+ years ago',
}

function InsiderLine({ insider }: { insider: InsiderSummary }) {
  const level = insider.roleLevel ?? 'Unknown level'
  const fn = insider.function ? `, ${insider.function}` : ''
  const tenure = insider.isCurrent ? 'A current employee' : `A former ${level}`
  return (
    <p className="text-sm">
      {insider.isCurrent ? `${tenure}${fn}` : `${tenure}${fn} — ${TENURE_LABEL[insider.tenureRecency]}`}
    </p>
  )
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Independent of each other — no need for getDashboardProfile to finish
  // before the company row lookup starts.
  const [profile, companyRow] = await Promise.all([
    getDashboardProfile(),
    // Admin-only working notes (priority, named HR contact) are stripped before any
    // component can see the row — see toCandidateCompany.
    prisma.company
      .findUnique({ where: { canonicalNameNormalized: decodeURIComponent(slug) } })
      .then((row) => (row ? toCandidateCompany(row) : null)),
  ])
  if (!companyRow) notFound()

  // industry/sizeBand/hqMetro are resolved lazily and Suspense-isolated
  // below (see CompanyMetaLine) since that resolution can be a real LLM
  // call — everything else on this page only needs the row's already-stored
  // fields (name, canonicalNameNormalized, atsPlatform), so `company` here
  // is just an alias, not a wait.
  const company = companyRow
  const redesign = isRedesignOn(profile.email)
  // Real DB id, still needed for every FK-based query below — only the URL
  // itself is slug-based now (canonicalNameNormalized). `slug` (not `id`) is
  // what gets passed as companyPageId to child forms/actions below, so
  // revalidatePath matches this route's actual URL.
  const id = company.id

  // NextChapter already has this candidate's work history — auto-tag it
  // into the insider-network graph rather than requiring a manual
  // per-company "Confirm" click for data already trusted everywhere else
  // (see autoTagAllWorkHistory's own comment). Awaited before the
  // hasTaggedEmployment check below so a first-ever visit already reads
  // as tagged, not "add where you've worked to unlock this."
  // The tagging step only gates the hasTaggedEmployment read, so it is chained
  // to that read inside the Promise.all below and the other, independent
  // queries run alongside it instead of waiting behind it.

  const [latestSignal, latestOutcome, alreadyTagged, publishedIntel, marketIntelTier, ownContactsHere, secondDegreeContacts, otherMembersContactCount, recruitingFirmData, dossierStatus, ownOutcomeHere] =
    await Promise.all([
      prisma.companySignal.findFirst({ where: { companyId: id }, orderBy: { weekStartDate: 'desc' } }),
      prisma.companyApplicationOutcome.findFirst({ where: { companyId: id }, orderBy: { weekStartDate: 'desc' } }),
      autoTagAllWorkHistory(profile.id).then(() => hasTaggedEmployment(profile.id)),
      getPublishedIntelForCompany(id),
      getCandidateMarketIntelTier(profile.id),
      getCandidateContactsAtCompany(profile.id, company.name),
      getSecondDegreeContactsAtCompany(profile.id, company.name),
      countOtherMembersWithContactAtCompany(profile.id, company.name),
      getRecruitingFirmData(company.name),
      isDossierUnlocked(profile.id),
      // "How to get hired here" auto-expands only once the candidate has
      // genuinely interviewed and been rejected AT THIS company — matched
      // the same way company-fit.ts does elsewhere on this page (normalized
      // equality against canonicalNameNormalized), not exact string match,
      // since JobPosting.companyName is free text.
      prisma.jobPosting.findMany({
        where: { candidateId: profile.id, companyName: { not: null }, interviewLandedAt: { not: null }, declinedAt: { not: null } },
        select: { companyName: true },
      }),
    ])
  const hadInterviewAndRejection = ownOutcomeHere.some(
    (p) => normalizeOrgName(p.companyName!) === company.canonicalNameNormalized
  )
  // Partners Master Build Script §A3.3 — insider network access is a Plus+
  // Market Intelligence feature. Company pages, hiring trajectory, posting
  // age, and skills demanded (everything else on this page) stay open to
  // everyone per that same table's row 1. Tagging your own employment stays
  // open to everyone regardless of tier — it's the free contribution that
  // grows the graph (see insider-network.ts's own comment: "the
  // contribution that unlocks the graph"). What's actually gated is the
  // ability to browse/ask insiders at OTHER companies; answering a question
  // someone already asked you also stays open at any tier, same "helping
  // out doesn't require paying" reasoning as tagging.
  const canInsiderNetwork = tierMeetsFeature(marketIntelTier, 'insider_network')

  const topFunctions =
    (latestSignal?.topFunctionsHiring as unknown as { function: string; count: number }[] | undefined) ?? []

  const [insiders, askerRequests, pendingToAnswer, ownCurrentEmployment] = await Promise.all([
    alreadyTagged && canInsiderNetwork ? getInsidersForCompany(id, profile.id) : Promise.resolve([]),
    getInsiderRequestsForAsker(profile.id),
    getPendingInsiderRequestsForInsider(profile.id),
    prisma.memberEmployment.findFirst({
      where: { candidateId: profile.id, companyId: id, isCurrent: true },
      select: { visibleAsInsider: true },
    }),
  ])

  const askerRequestsHere = askerRequests.filter((r) => r.companyId === id)
  const pendingToAnswerHere = pendingToAnswer.filter((r) => r.companyId === id)

  // On the curated list of employers known for pay / benefits (names only, no rank).
  const topEmployer = findTopEmployer(company.canonicalNameNormalized) ?? findTopEmployer(company.name)

  captureServerEvent(profile.id, 'company_page_viewed', {
    companyId: id,
    companyName: company.name,
    knownFor: topEmployer ? topEmployer.reasons : null,
  })

  const outcomeCells = latestOutcome
    ? suppressSmallCells([latestOutcome], (r) => r.applications, () => 'How members have fared')
    : []
  const outcomeCell = outcomeCells[0]

  // True only when this candidate has tagged THIS company as their current
  // employer but hasn't yet opted in to appear as a current-employee
  // insider — the explicit, separate opt-in Prompt 4.2 requires.
  const currentEmployerUntagged = !!ownCurrentEmployment && !ownCurrentEmployment.visibleAsInsider

  const rolesPast12wk = latestSignal ? latestSignal.openRolesTotal - latestSignal.rolesDelta12wk : 0
  const pct12wk =
    latestSignal && rolesPast12wk > 0 ? Math.round((latestSignal.rolesDelta12wk / rolesPast12wk) * 100) : null

  const TrajectoryIcon =
    latestSignal?.trajectory === 'growing' ? TrendingUp : latestSignal?.trajectory === 'contracting' ? TrendingDown : Minus

  const headerBlock = (
    <>
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Building2 className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{company.name}</h1>
          <Suspense fallback={<CompanyMetaLineSkeleton />}>
            <CompanyMetaLine companyRow={companyRow} />
          </Suspense>
          {topEmployer && (
            <div className="mt-2 space-y-0.5">
              <p className="text-sm text-foreground">
                <span className="font-medium">Known for:</span> {knownForLabel(topEmployer)}
              </p>
              <p className="text-xs text-muted-foreground">{topEmployerSourceLine(topEmployer)}</p>
            </div>
          )}
        </div>
      </div>

    </>
  )

  const signalBlock = (
    <>
      {/* ── Hiring signal ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrajectoryIcon className="size-4" aria-hidden="true" />
            Hiring signal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestSignal ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                <span className="font-medium">Open roles: {latestSignal.openRolesTotal}</span>
                {latestSignal.openRolesDirectorPlus > 0 && ` (${latestSignal.openRolesDirectorPlus} at director level and above)`}
                {pct12wk !== null && (
                  <>
                    {' · '}
                    {pct12wk >= 0 ? `Up ${pct12wk}%` : `Down ${Math.abs(pct12wk)}%`} in 12 weeks
                  </>
                )}
              </p>
              {topFunctions.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Hiring most in: {topFunctions.map((f) => f.function).join(', ')}
                </p>
              )}
              {latestSignal.medianPostingAgeDays !== null && (
                <p className="text-sm text-muted-foreground">
                  Median posting age: {latestSignal.medianPostingAgeDays} days
                  {latestSignal.medianPostingAgeDays >= 90 && ' — roles sitting this long can signal a slow process, not necessarily a bad one. Worth asking about in the loop.'}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Trajectory ({latestSignal.trajectory}) is based on posting activity only — not WARN filings (see below).
              </p>
            </div>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No hiring signal yet"
              description="This company doesn't have active job board postings we can compute a signal from yet."
            />
          )}
        </CardContent>
      </Card>

    </>
  )

  const hiringBlock = (
    <>
      {/* ── Hiring history and pay: every opening we've seen, market pay ── */}
      <Suspense fallback={<CompanyHiringIndexSkeleton />}>
        <CompanyHiringIndex companyId={id} viewer="candidate" />
      </Suspense>

      <CompanyIntelPanels companyId={id} />

    </>
  )

  const cultureBlock = (
    <>
      {/* ── Insider culture: combined answers of members who worked here ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            What people who worked here say
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense fallback={<SectionSkeleton label="Loading what people say…" />}>
            <CompanyCultureSection companyId={id} companyName={company.name} slug={slug} candidateId={profile.id} />
          </Suspense>
        </CardContent>
      </Card>

    </>
  )

  const howToBlock = (
    <>
      {/* ── How to get hired here ──
          Minimized by default — expanded automatically only once this
          candidate has actually interviewed and been rejected here
          (hadInterviewAndRejection), when the guidance is genuinely
          relevant to look back on, not just "someone might read this
          someday." */}
      <Accordion defaultValue={hadInterviewAndRejection ? ['how-to-get-hired'] : []}>
        <AccordionItem value="how-to-get-hired">
          <AccordionTrigger className="px-5 py-4 hover:text-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" aria-hidden="true" />
              <CardTitle>How to get hired here</CardTitle>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <div className="flex flex-col gap-4">
              {publishedIntel.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No guidance yet"
                  description="Be the first to share what the interview process here is really like."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <ShowMoreList pageSize={5}>
                    {publishedIntel.map((intel) => (
                      <div key={intel.id} className="rounded-lg border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground">{INTEL_TYPE_LABEL[intel.intelType as IntelType]}</p>
                        <p className="mt-1 text-sm">{intel.body}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {intel.roleLevelAtTime ? `A former ${intel.roleLevelAtTime}` : 'A member'}
                            {intel.recencyBucket ? ` — ${TENURE_LABEL[intel.recencyBucket] ?? intel.recencyBucket}` : ''}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{intel.helpfulCount} found this helpful</span>
                            <MarkHelpfulButton intelId={intel.id} companyPageId={slug} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </ShowMoreList>
                </div>
              )}
              <SubmitIntelForm companyId={id} companyPageId={slug} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

    </>
  )

  const faredBlock = (
    <>
      {/* ── How members have fared ── */}
      <Card>
        <CardHeader>
          <CardTitle>How members have fared</CardTitle>
        </CardHeader>
        <CardContent>
          {!outcomeCell ? (
            <p className="text-sm text-muted-foreground">Not enough tracked applications to this company yet.</p>
          ) : isSuppressedCell(outcomeCell) ? (
            <p className="text-sm text-muted-foreground">Insufficient data — fewer than 5 members have applied here.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-medium">{outcomeCell.applications} members applied.</span>{' '}
                {outcomeCell.responses} heard back. {outcomeCell.interviews} reached interview.
                {outcomeCell.applications > 0 && (
                  <>
                    {' '}
                    Response rate {Math.round((outcomeCell.responses / outcomeCell.applications) * 100)}%.
                  </>
                )}
              </p>
              {outcomeCell.avgDaysToInterview !== null && (
                <p className="text-sm text-muted-foreground">
                  Averages {outcomeCell.avgDaysToInterview} days from submission to interview
                  {outcomeCell.avgDaysToRejection !== null && `, ${outcomeCell.avgDaysToRejection} days to rejection`}.
                </p>
              )}
              {outcomeCell.avgDaysToInterview === null && outcomeCell.avgDaysToRejection !== null && (
                <p className="text-sm text-muted-foreground">
                  Averages {outcomeCell.avgDaysToRejection} days from submission to rejection.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </>
  )

  const ownBlock = (
    <>
      {/* ── Your own contacts at this company ──
          Grouped by employmentStatusAtCompany — candidate-confirmed only
          (see that field's schema comment for why this can't be inferred).
          Unconfirmed contacts get inline "Still there?"/"They left" buttons
          right where the candidate is already looking at this company. */}
      {ownContactsHere.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden="true" />
              Your contacts here ({ownContactsHere.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ['CURRENT', 'Current'],
                ['FORMER', 'Former'],
                [null, 'Unconfirmed'],
              ] as const
            ).map(([status, label]) => {
              const group = ownContactsHere.filter((c) => c.employmentStatusAtCompany === status)
              if (group.length === 0) return null
              return (
                <div key={label} className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {group.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between gap-3 p-3">
                        <Link
                          href={`/dashboard/network/contacts/${contact.id}`}
                          className="min-w-0 hover:opacity-80"
                        >
                          <p className="text-sm font-medium text-foreground">{contact.name}</p>
                          {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
                        </Link>
                        {status === null && (
                          <ContactEmploymentStatusButtons contactId={contact.id} companyPageId={slug} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

    </>
  )

  const secondBlock = (
    <>
      {/* ── 2nd-degree connections — "who do I know who knows someone
          here?" Only the bridge contact's identity and a count are shown,
          never the bridge's own contacts' names — see
          getSecondDegreeContactsAtCompany's doc comment for why. ── */}
      {secondDegreeContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden="true" />
              People your contacts might know here
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-lg border border-border">
              {secondDegreeContacts.map(({ bridge, contactCount }) => (
                <div key={bridge.id} className="flex items-center justify-between gap-3 p-3">
                  <Link href={`/dashboard/network/contacts/${bridge.id}`} className="min-w-0 hover:opacity-80">
                    <p className="text-sm font-medium text-foreground">{bridge.name}</p>
                    {bridge.title && <p className="text-xs text-muted-foreground">{bridge.title}</p>}
                  </Link>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    Knows {contactCount} {contactCount === 1 ? 'person' : 'people'} here
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </>
  )

  const insidersBlock = (
    <>
      {/* ── People who know this company (insider network) ── */}
      <Card id="insiders" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            People who know this company
          </CardTitle>
          {otherMembersContactCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {otherMembersContactCount} other NextChapter member{otherMembersContactCount === 1 ? ' has' : 's have'} a
              personal contact here too.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!alreadyTagged ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Add where you&apos;ve worked to unlock this — members who&apos;ve worked somewhere can see who
                  else has, and get asked in return.
                </p>
              </div>
              <ManualTagForm companyPageId={slug} defaultCompanyName={company.name} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {currentEmployerUntagged && <CurrentEmployerInsiderOptIn companyId={id} companyPageId={slug} />}

              {/* Partners Master Build Script §A3.3 — insider network ACCESS
                  (browsing/asking insiders at this company) is Plus+.
                  Tagging your own employment above stays free at every tier
                  — it's the contribution that grows the graph everyone else
                  benefits from. */}
              {!canInsiderNetwork ? (
                <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-orange" aria-hidden="true" />
                    <p className="text-sm font-medium text-orange">{MARKET_INTEL_TIER_LABEL.PLUS} only</p>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Thanks for tagging your employer — that helps other members. Browsing and asking the members who
                    worked here is a Plus and above Market Intelligence feature. See{' '}
                    <a href="/dashboard/market-intelligence" className="text-primary underline underline-offset-4">
                      Market Intelligence
                    </a>{' '}
                    for details.
                  </p>
                </div>
              ) : insiders.length === 0 ? (
                <EmptyState icon={Users} title="No insiders yet" description="No members have tagged this employer yet." />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">{insiders.length} member{insiders.length === 1 ? '' : 's'} worked here.</p>
                  <ShowMoreList pageSize={5}>
                    {insiders.map((insider) => (
                      <div key={insider.memberEmploymentId} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                        <InsiderLine insider={insider} />
                        <AskInsiderForm companyId={id} insiderMemberEmploymentId={insider.memberEmploymentId} companyPageId={slug} />
                      </div>
                    ))}
                  </ShowMoreList>
                </div>
              )}

              {askerRequestsHere.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Your questions</p>
                  {askerRequestsHere.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{r.question}</p>
                      {r.status === 'answered' ? (
                        <p className="mt-1 text-muted-foreground">{r.answer}</p>
                      ) : r.status === 'expired' ? (
                        <p className="mt-1 text-xs text-muted-foreground">Expired — no response after 14 days.</p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">No response yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pendingToAnswerHere.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <MessageSquare className="size-4" aria-hidden="true" />
                    Someone asked you about this company
                  </p>
                  {pendingToAnswerHere.map((r) => (
                    <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">{r.question}</p>
                      <AnswerInsiderRequestForm requestId={r.id} companyPageId={slug} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </>
  )

  const recruitBlock = (
    <>
      {/* ── Recruiting firm sections — only when this company IS a
          recognized staffing/search firm (Recruiter.firmName or
          RecruiterFirm.name fuzzy-matches it). Recruiters have no FK to
          Company today (confirmed — everything is string-matched, same as
          every other company link in this codebase), so this section
          simply doesn't render for a company with zero matched recruiters,
          rather than showing an empty "0 recruiters here" card on every
          ordinary employer's page. The jobs are open to every member (owner's
          rule, 2026-10-16); the recruiter names stay on the isDossierUnlocked()
          bar, like the rest of the Executive Recruiter Network. */}
      {recruitingFirmData.recruiters.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="size-4" aria-hidden="true" />
                Jobs they&apos;re hiring for ({recruitingFirmData.jobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recruitingFirmData.jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open postings from this firm right now.</p>
              ) : (
                <ShowMoreList pageSize={5}>
                  {recruitingFirmData.jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{job.title}</p>
                        {job.location && <p className="text-xs text-muted-foreground">{job.location}</p>}
                      </div>
                    </div>
                  ))}
                </ShowMoreList>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" />
                Recruiters here ({recruitingFirmData.recruiters.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dossierStatus.unlocked ? (
                <ul className="space-y-1">
                  {recruitingFirmData.recruiters.map((r) => (
                    <li key={r.id} className="text-sm text-foreground">
                      {r.fullName}
                    </li>
                  ))}
                </ul>
              ) : (
                <LockedFeatureNotice
                  title="Recruiter names"
                  requirement={`${recruitingFirmData.recruiters.length} recruiter${recruitingFirmData.recruiters.length === 1 ? '' : 's'} ready to view once your Dossier unlocks.`}
                  status={dossierStatus.reason}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

    </>
  )

  if (redesign) {
    const signalText = latestSignal
      ? hiringSignalText({
          openRolesTotal: latestSignal.openRolesTotal,
          openRolesDirectorPlus: latestSignal.openRolesDirectorPlus,
          rolesDelta12wk: latestSignal.rolesDelta12wk,
          trajectory: latestSignal.trajectory,
          medianPostingAgeDays: latestSignal.medianPostingAgeDays,
          topFunctions: topFunctions.map((f) => f.function),
        })
      : null
    const rSignal = (
      <SectionBlock id="signal-h" title="Is it hiring?" why={signalText ? undefined : 'We do not have active job board postings to compute a signal from yet. Check back as the company posts.'}>
        {signalText && (
          <>
            <PlainNote>
              <span className="font-semibold">{signalText.headline}</span> {signalText.because}
            </PlainNote>
            {signalText.facts.map((f) => (
              <SourceLine key={f}>{f}</SourceLine>
            ))}
          </>
        )}
      </SectionBlock>
    )
    const rOwn = ownContactsHere.length > 0 && (
      <SectionBlock id="own-h" title={`People you know here (${ownContactsHere.length})`} why="Ask them first: a warm introduction beats an application.">
        <RowList
          label="Your contacts at this company"
          items={ownContactsHere.map((contact) => ({
            key: contact.id,
            title: contact.name,
            why: contact.title ?? undefined,
            fact: contact.employmentStatusAtCompany === 'CURRENT' ? 'Works there now.' : contact.employmentStatusAtCompany === 'FORMER' ? 'Used to work there.' : 'We have not confirmed whether they are still there.',
            actions: (
              <>
                {contact.employmentStatusAtCompany === null && <ContactEmploymentStatusButtons contactId={contact.id} companyPageId={slug} />}
                <ActionLink href={`/dashboard/network/contacts/${contact.id}`} event="company_contact_opened" props={{ companyId: id, contactId: contact.id }}>
                  Open
                </ActionLink>
              </>
            ),
          }))}
        />
      </SectionBlock>
    )
    const rSecond = secondDegreeContacts.length > 0 && (
      <SectionBlock id="second-h" title="People your contacts might know here" why="We show your contact and how many people they know here, never their names.">
        <RowList
          label="Contacts who know people here"
          items={secondDegreeContacts.map(({ bridge, contactCount }) => ({
            key: bridge.id,
            title: bridge.name,
            why: bridge.title ?? undefined,
            fact: `Knows ${contactCount} ${contactCount === 1 ? 'person' : 'people'} here.`,
            actions: (
              <ActionLink href={`/dashboard/network/contacts/${bridge.id}`} event="company_bridge_opened" props={{ companyId: id, contactId: bridge.id }}>
                Open
              </ActionLink>
            ),
          }))}
        />
      </SectionBlock>
    )
    const rInsiders = (
      <div id="insiders" className="scroll-mt-4">
        <SectionBlock
          id="insiders-h"
          title="Members who know this company"
          why={
            otherMembersContactCount > 0
              ? `${otherMembersContactCount} other NextChapter member${otherMembersContactCount === 1 ? ' has' : 's have'} a personal contact here too.`
              : 'Members who worked here can answer what a job post cannot.'
          }
        >
          {!alreadyTagged ? (
            <div className="space-y-3">
              <EmptyNote>Add where you have worked and you can see who else has worked here. Members who have worked somewhere can ask each other questions.</EmptyNote>
              <ManualTagForm companyPageId={slug} defaultCompanyName={company.name} />
            </div>
          ) : (
            <div className="space-y-5">
              {currentEmployerUntagged && <CurrentEmployerInsiderOptIn companyId={id} companyPageId={slug} />}
              {!canInsiderNetwork ? (
                <EmptyNote>
                  Thank you for tagging your employer; that helps other members. Browsing and asking the members who worked here is part of {MARKET_INTEL_TIER_LABEL.PLUS} and above Market Intelligence.{' '}
                  <a href="/dashboard/market-intelligence" className="font-medium text-brand underline underline-offset-4">
                    See Market Intelligence
                  </a>
                </EmptyNote>
              ) : insiders.length === 0 ? (
                <EmptyNote>No members have tagged this employer yet. When one does, you can ask them a question here.</EmptyNote>
              ) : (
                <div className="space-y-3">
                  <PlainNote>
                    <span className="font-semibold">{insiders.length} member{insiders.length === 1 ? '' : 's'}</span> worked here.
                  </PlainNote>
                  <div className="divide-y divide-border rounded-2xl border border-border">
                    <ShowMoreList pageSize={5}>
                      {insiders.map((insider) => (
                        <div key={insider.memberEmploymentId} className="space-y-2 p-5">
                          <p className="text-base font-semibold text-ink">
                            {insider.isCurrent ? `A current employee${insider.function ? `, ${insider.function}` : ''}` : `A former ${insider.roleLevel ?? 'employee'}${insider.function ? `, ${insider.function}` : ''}`}
                          </p>
                          {!insider.isCurrent && <p className="text-sm text-muted-foreground">Left {TENURE_LABEL[insider.tenureRecency]?.replace('left ', '') ?? 'a while ago'}.</p>}
                          <AskInsiderForm companyId={id} insiderMemberEmploymentId={insider.memberEmploymentId} companyPageId={slug} />
                        </div>
                      ))}
                    </ShowMoreList>
                  </div>
                </div>
              )}
              {askerRequestsHere.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-ink">Your questions</h3>
                  <FactList
                    label="Your questions"
                    items={askerRequestsHere.map((r) => ({
                      key: r.id,
                      name: r.question,
                      fact: r.status === 'answered' ? r.answer : r.status === 'expired' ? 'Expired: no response after 14 days.' : 'No response yet.',
                    }))}
                  />
                </div>
              )}
              {pendingToAnswerHere.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-ink">Someone asked you about this company</h3>
                  {pendingToAnswerHere.map((r) => (
                    <div key={r.id} className="space-y-2 rounded-2xl border border-border p-5">
                      <p className="text-base font-semibold text-ink">{r.question}</p>
                      <AnswerInsiderRequestForm requestId={r.id} companyPageId={slug} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionBlock>
      </div>
    )
    const rHiring = (
      <>
        <Suspense fallback={<CompanyHiringIndexSkeleton redesign />}>
          <CompanyHiringIndex companyId={id} viewer="candidate" redesign />
        </Suspense>
        <CompanyIntelPanels companyId={id} redesign />
      </>
    )
    const rCulture = (
      <SectionBlock id="culture-h" title="What people who worked here say" why="Combined answers from members who worked here. Nobody's answers are shown on their own.">
        <Suspense fallback={<SectionSkeleton label="Loading what people say…" />}>
          <CompanyCultureSection companyId={id} companyName={company.name} slug={slug} candidateId={profile.id} redesign />
        </Suspense>
      </SectionBlock>
    )
    const rHowTo = <CompanyHowToRedesign companyId={id} slug={slug} intel={publishedIntel} />
    const rFared = (
      <SectionBlock id="fared-h" title="How members have fared" why="Tracked applications from NextChapter members. Groups under 5 are not shown.">
        {!outcomeCell ? (
          <EmptyNote>Not enough tracked applications to this company yet.</EmptyNote>
        ) : isSuppressedCell(outcomeCell) ? (
          <EmptyNote>Fewer than 5 members have applied here, so we do not show it.</EmptyNote>
        ) : (
          <>
            <PlainNote>
              <span className="font-semibold">{outcomeCell.applications} members applied.</span> {outcomeCell.responses} heard back and {outcomeCell.interviews} reached an interview
              {outcomeCell.applications > 0 ? `, a ${Math.round((outcomeCell.responses / outcomeCell.applications) * 100)}% response rate` : ''}.
            </PlainNote>
            {(outcomeCell.avgDaysToInterview !== null || outcomeCell.avgDaysToRejection !== null) && (
              <SourceLine>
                {outcomeCell.avgDaysToInterview !== null
                  ? `Averages ${outcomeCell.avgDaysToInterview} days from submission to interview${outcomeCell.avgDaysToRejection !== null ? `, ${outcomeCell.avgDaysToRejection} days to rejection` : ''}.`
                  : `Averages ${outcomeCell.avgDaysToRejection} days from submission to rejection.`}
              </SourceLine>
            )}
          </>
        )}
      </SectionBlock>
    )
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title={company.name}
          action={
            <ActionLink href="#insiders" kind="primary" event="company_ask_someone_clicked" props={{ companyId: id, source: 'company_page' }}>
              Ask someone there
            </ActionLink>
          }
        />
        <div className="space-y-2">
          <Suspense fallback={<CompanyMetaLineSkeleton />}>
            <CompanyMetaLine companyRow={companyRow} />
          </Suspense>
          {topEmployer && (
            <p className="text-sm text-foreground">
              <span className="font-medium">Known for:</span> {knownForLabel(topEmployer)}. <span className="text-muted-foreground">{topEmployerSourceLine(topEmployer)}</span>
            </p>
          )}
        </div>
        {rOwn}
        {rSignal}
        {rInsiders}
        <ShowMore page="company_profile">
          {rSecond}
          {rFared}
          {rHiring}
          {rCulture}
          {rHowTo}
          {recruitBlock}
        </ShowMore>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {headerBlock}
      {signalBlock}
      {hiringBlock}
      {cultureBlock}
      {howToBlock}
      {faredBlock}
      {ownBlock}
      {secondBlock}
      {insidersBlock}
      {recruitBlock}
    </div>
  )
}
