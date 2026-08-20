import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Building2, TrendingUp, TrendingDown, Minus, Users, Lock, MessageSquare, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { CompanyMetaLine, CompanyMetaLineSkeleton } from '@/components/companies/CompanyMetaLine'
import { ShowMoreList } from '@/components/dashboard/ShowMoreList'
import {
  hasTaggedEmployment,
  getInsidersForCompany,
  getInsiderRequestsForAsker,
  getPendingInsiderRequestsForInsider,
  type InsiderSummary,
} from '@/lib/companies/insider-network'
import { getUntaggedWorkHistory } from '@/lib/companies/employment-tagging'
import { getCandidateContactsAtCompany } from '@/lib/companies/candidate-contacts-at-company'
import { getPublishedIntelForCompany, INTEL_TYPE_LABEL, type IntelType } from '@/lib/companies/company-intel'
import { computeCompanyFitForCandidate } from '@/lib/companies/company-fit'
import type { RankedSkill } from '@/lib/companies/skills-extraction'
import { suppressSmallCells, isSuppressedCell } from '@/lib/admin/cell-suppression'
import { captureServerEvent } from '@/lib/posthog/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FIT_BUCKET_LABEL } from '@/lib/jobs/fit-bucket-types'
import {
  ConfirmWorkHistoryButton,
  ManualTagForm,
  CurrentEmployerInsiderOptIn,
} from '@/components/companies/EmploymentTagging'
import { AskInsiderForm, AnswerInsiderRequestForm } from '@/components/companies/InsiderNetworkControls'
import { SubmitIntelForm, MarkHelpfulButton } from '@/components/companies/CompanyIntelControls'
import { getCandidateMarketIntelTier, tierMeetsFeature, MARKET_INTEL_TIER_LABEL } from '@/lib/market-intelligence/access'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const company = await prisma.company.findUnique({ where: { id }, select: { name: true } })
  return { title: company ? company.name : 'Company' }
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

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Independent of each other — no need for getDashboardData to finish
  // before the company row lookup starts.
  const [profile, companyRow] = await Promise.all([
    getDashboardData(),
    prisma.company.findUnique({ where: { id } }),
  ])
  if (!companyRow) notFound()

  // industry/sizeBand/hqMetro are resolved lazily and Suspense-isolated
  // below (see CompanyMetaLine) since that resolution can be a real LLM
  // call — everything else on this page only needs the row's already-stored
  // fields (name, canonicalNameNormalized, atsPlatform), so `company` here
  // is just an alias, not a wait.
  const company = companyRow

  const [latestSignal, latestOutcome, alreadyTagged, publishedIntel, marketIntelTier, ownContactsHere] = await Promise.all([
    prisma.companySignal.findFirst({ where: { companyId: id }, orderBy: { weekStartDate: 'desc' } }),
    prisma.companyApplicationOutcome.findFirst({ where: { companyId: id }, orderBy: { weekStartDate: 'desc' } }),
    hasTaggedEmployment(profile.id),
    getPublishedIntelForCompany(id),
    getCandidateMarketIntelTier(profile.id),
    getCandidateContactsAtCompany(profile.id, company.name),
  ])
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

  const topSkills = ((latestSignal?.topSkillsRequested as unknown as RankedSkill[] | undefined) ?? []).slice(0, 10)
  const topFunctions =
    (latestSignal?.topFunctionsHiring as unknown as { function: string; count: number }[] | undefined) ?? []

  const [fit, untaggedWorkHistory, insiders, askerRequests, pendingToAnswer, ownCurrentEmployment] = await Promise.all([
    computeCompanyFitForCandidate(profile.id, company.canonicalNameNormalized, topSkills),
    alreadyTagged ? Promise.resolve([]) : getUntaggedWorkHistory(profile.id),
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

  captureServerEvent(profile.id, 'company_page_viewed', { companyId: id, companyName: company.name })

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

  return (
    <div className="flex flex-col gap-6 pb-12">
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
        </div>
      </div>

      {/* ATS platform — no real per-employer ATS signal exists anywhere in
          this codebase (see Company.atsPlatform's schema comment). Explicit
          "not available yet" rather than a guess, per design-principles.md's
          "never disable without explaining why" rule. */}
      {!company.atsPlatform && (
        <p className="text-xs text-muted-foreground">
          Which ATS this company uses isn&apos;t available yet — we&apos;ll show it here once we can detect it.
        </p>
      )}

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

      {/* ── Contraction signal ──
          No WARN monitoring agent exists anywhere in this codebase — zero
          cron, zero model. Never fabricate a WARN number here; explicit
          "not available yet" state instead of a fake callout box. */}
      <Card>
        <CardHeader>
          <CardTitle>Contraction signal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            WARN-filing monitoring isn&apos;t built yet, so this section can&apos;t show layoff filings for this
            company. The hiring signal above (based on posting activity) is the only trajectory data currently
            available.
          </p>
        </CardContent>
      </Card>

      {/* ── Skills they hire for ── */}
      <Card>
        <CardHeader>
          <CardTitle>Skills they hire for</CardTitle>
        </CardHeader>
        <CardContent>
          {topSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough posting text yet to extract a ranked skills list.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {topSkills.map((s) => (
                  <span
                    key={s.term}
                    className={
                      fit.matchedSkills.includes(s.term)
                        ? 'rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary'
                        : 'rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {s.term}
                  </span>
                ))}
              </div>
              {fit.missingSkills.length > 0 && (
                <p className="text-sm">
                  You match {fit.matchedSkills.length} of their top {topSkills.length}. Missing:{' '}
                  {fit.missingSkills.slice(0, 5).join(', ')}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── How to get hired here ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden="true" />
            How to get hired here
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                          <MarkHelpfulButton intelId={intel.id} companyPageId={id} />
                        </div>
                      </div>
                    </div>
                  ))}
                </ShowMoreList>
              </div>
            )}
            <SubmitIntelForm companyId={id} companyPageId={id} />
          </div>
        </CardContent>
      </Card>

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
          )}
        </CardContent>
      </Card>

      {/* ── Your own contacts at this company ── */}
      {ownContactsHere.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden="true" />
              Your contacts here
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-lg border border-border">
              {ownContactsHere.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/dashboard/network/contacts/${contact.id}`}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{contact.name}</p>
                    {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── People who know this company (insider network) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            People who know this company
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!alreadyTagged ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Add where you&apos;ve worked to unlock this. We&apos;ll pull it from your resume — just confirm.
                  Members who tag their history can see who&apos;s worked at companies they&apos;re targeting, and
                  get asked in return.
                </p>
              </div>
              {untaggedWorkHistory.length > 0 && (
                <div className="flex flex-col gap-2">
                  {untaggedWorkHistory.map((w) => (
                    <div key={w.workHistoryEntryId} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">{w.companyName}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.roleTitle}
                          {w.isCurrent && ' · Current'}
                        </p>
                      </div>
                      <ConfirmWorkHistoryButton workHistoryEntryId={w.workHistoryEntryId} companyPageId={id} />
                    </div>
                  ))}
                </div>
              )}
              <ManualTagForm companyPageId={id} defaultCompanyName={untaggedWorkHistory.length === 0 ? company.name : undefined} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {currentEmployerUntagged && <CurrentEmployerInsiderOptIn companyId={id} companyPageId={id} />}

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
                        <AskInsiderForm companyId={id} insiderMemberEmploymentId={insider.memberEmploymentId} companyPageId={id} />
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
                      <AnswerInsiderRequestForm requestId={r.id} companyPageId={id} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Your fit ── */}
      <Card>
        <CardHeader>
          <CardTitle>Your fit</CardTitle>
        </CardHeader>
        <CardContent>
          {fit.bucket ? (
            <p className="text-sm">
              <span className="font-medium">{FIT_BUCKET_LABEL[fit.bucket]}</span> fit against their open roles
              {fit.bestPostingTitle && ` (best match: "${fit.bestPostingTitle}")`}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No open roles at this company to compare your fit against right now.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
