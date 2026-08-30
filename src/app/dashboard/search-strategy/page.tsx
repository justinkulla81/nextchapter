import type { Metadata } from 'next'
import type { CandidateProfile } from '@prisma/client'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import {
  getSearchStage,
  isSearchGoalsComplete,
  isBlockersAndMotivationsComplete,
  isMarketingPlanWillingnessComplete,
  isNetworkingWillingnessComplete,
  isNegotiationInterviewComfortComplete,
  isSearchStrategySoFarComplete,
  isBenefitsComplete,
  isBoardAdvisoryWillingnessComplete,
} from '@/lib/search-strategy'
import { getOrDraftSearchStrategyGuidance } from '@/lib/reports/search-strategy-guidance'
import { computeSearchStrategyChecklist, type SearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { SearchStrategyWizard, type WizardPage } from '@/components/dashboard/SearchStrategyWizard'
import { SearchStrategyForm } from '@/components/dashboard/SearchStrategyForm'
import { OptionalQuestionsForm } from '@/components/dashboard/OptionalQuestionsForm'
import { PersonalContextForm } from '@/components/dashboard/PersonalContextForm'
import { MarketingPlanWillingnessForm } from '@/components/dashboard/MarketingPlanWillingnessForm'
import { BoardAdvisoryWillingnessForm } from '@/components/dashboard/BoardAdvisoryWillingnessForm'
import { NetworkingWillingnessForm } from '@/components/dashboard/NetworkingWillingnessForm'
import { NegotiationInterviewComfortForm } from '@/components/dashboard/NegotiationInterviewComfortForm'
import { BenefitsPrioritiesForm } from '@/components/dashboard/BenefitsPrioritiesForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Spinner } from '@/components/ui/spinner'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { inferIndustriesFromWorkHistory } from '@/lib/onboarding/infer-industries'

export const metadata: Metadata = { title: 'My Search Strategy' }

// getOrDraftSearchStrategyGuidance makes a direct, uncached (on this specific
// profile) Anthropic call whenever the draft is missing or was invalidated
// by a Search Goals save — isolated in its own Suspense boundary so the rest
// of the page renders immediately regardless of how long guidance takes.
// Only mounted once the candidate has seen Victoria's guidance at least once
// (see hasAnsweredOnce in SearchStrategyPage below) — before that, drafting
// happens silently via SearchStrategyGuidanceTrigger instead, with no
// Victoria-branded card on screen yet.
interface TrendBreakdownEntry {
  label: string
  count: number
}

interface RejectionTrendsData {
  eligible: boolean
  minRequired: number
  totalRejections: number
  companySizeBreakdown: TrendBreakdownEntry[] | null
  industryBreakdown: TrendBreakdownEntry[] | null
  functionBreakdown: TrendBreakdownEntry[] | null
  levelFitBreakdown: TrendBreakdownEntry[] | null
}

async function SearchStrategyGuidanceCard({
  profile,
  checklist,
}: {
  profile: CandidateProfile
  checklist: SearchStrategyChecklist
}) {
  const targetRoleComplete = isSearchGoalsComplete(profile)
  const blockersMotivationsComplete = isBlockersAndMotivationsComplete(profile)
  const goalsComplete = targetRoleComplete && blockersMotivationsComplete
  const strategyGuidance = goalsComplete ? await getOrDraftSearchStrategyGuidance(profile.id) : null

  // Independent of Search Goals completion — a candidate can have logged
  // rejections before finishing their profile. Read-only from the same
  // report-generation-time computation as the Market Reality page's
  // Rejection Patterns section (computeRejectionTrends), never a second
  // live computation.
  const latestReportForRejections = await prisma.marketRealityReport.findFirst({
    where: { candidateId: profile.id },
    orderBy: { generatedAt: 'desc' },
    select: { jobSearchPattern: true },
  })
  const rejectionTrends =
    (latestReportForRejections?.jobSearchPattern as unknown as { rejectionTrends: RejectionTrendsData | null } | null)
      ?.rejectionTrends ?? null

  const missingSections = [
    !targetRoleComplete && 'Your Target Role & Company',
    !blockersMotivationsComplete && 'Blockers and Motivations',
  ].filter((v): v is string => !!v)

  return (
    <Accordion defaultValue={['strategy-guidance']}>
      <AccordionItem value="strategy-guidance" className="border-brand/20 bg-brand/5">
        <AccordionTrigger className="px-5 py-4 hover:text-foreground">
          <div className="flex items-center gap-3">
            <VictoriaAvatar size={36} />
            <CardTitle className="text-sm font-medium text-foreground">Strategy Guidance from Victoria</CardTitle>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5">
        {strategyGuidance ? (
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-success uppercase">What&apos;s working</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground">
                  {strategyGuidance.pros.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-warning uppercase">What to watch</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground">
                  {strategyGuidance.cons.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-brand uppercase">What I&apos;d change</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground">
                  {strategyGuidance.suggestedChanges.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
            {checklist.incomplete.length > 0 && (
              <div className="rounded-lg border border-dashed border-brand/40 bg-white p-3">
                <p className="text-xs font-medium text-foreground">
                  Answer these for even more personalized advice from me:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {checklist.incomplete.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className="text-sm text-primary underline underline-offset-4"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : missingSections.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Complete {missingSections.join(' and ')} below to get your Strategy Guidance from me.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            I&apos;m updating your guidance based on your latest answers — check back in a moment.
          </p>
        )}
        {rejectionTrends?.eligible &&
          (() => {
            const groups = [
              { label: 'Company size', breakdown: rejectionTrends.companySizeBreakdown },
              { label: 'Industry', breakdown: rejectionTrends.industryBreakdown },
              { label: 'Function', breakdown: rejectionTrends.functionBreakdown },
              { label: 'Level fit', breakdown: rejectionTrends.levelFitBreakdown },
            ].filter((g) => g.breakdown && g.breakdown.length > 0)
            if (groups.length === 0) return null
            return (
              <div className="mt-4 rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-foreground uppercase">Rejection patterns</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-foreground">
                  {groups.map((group) => (
                    <li key={group.label}>
                      <span className="font-medium">{group.label}:</span>{' '}
                      {group.breakdown!.map((b) => `${b.label} (${b.count})`).join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function SearchStrategyGuidanceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <VictoriaAvatar size={36} />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Strategy Guidance from Victoria
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={16} />
          Putting together your strategy guidance…
        </div>
      </CardContent>
    </Card>
  )
}

// Drafts guidance in the background, before the candidate has ever seen
// Victoria's card — no visible output, so the first time she actually has
// something to say is the first time her name/avatar shows up on this page.
// Once getOrDraftSearchStrategyGuidance succeeds it sets
// searchStrategyFirstAnsweredAt, and the next page load renders the real
// SearchStrategyGuidanceCard above instead of this.
async function SearchStrategyGuidanceTrigger({ profile }: { profile: CandidateProfile }) {
  if (isSearchGoalsComplete(profile) && isBlockersAndMotivationsComplete(profile)) {
    await getOrDraftSearchStrategyGuidance(profile.id)
  }
  return null
}

export default async function SearchStrategyPage() {
  const profile = await getDashboardData()
  const stage = getSearchStage(profile)
  const hasAnsweredOnce = !!profile.searchStrategyFirstAnsweredAt
  const targetRoleComplete = isSearchGoalsComplete(profile)
  const blockersMotivationsComplete = isBlockersAndMotivationsComplete(profile)
  const marketingPlanWillingnessComplete = isMarketingPlanWillingnessComplete(profile)
  const boardAdvisoryWillingnessComplete = isBoardAdvisoryWillingnessComplete(profile)
  const networkingWillingnessComplete = isNetworkingWillingnessComplete(profile)
  const negotiationInterviewComfortComplete = isNegotiationInterviewComfortComplete(profile)
  const optionalQuestionsAnswered = isSearchStrategySoFarComplete(profile)
  const benefitsAnswered = isBenefitsComplete(profile)
  // getDashboardData doesn't order workHistory — sort here so the recency
  // tiebreak inside inferIndustriesFromWorkHistory (first-seen index wins)
  // actually reflects most-recent-first.
  const workHistoryByRecency = [...profile.workHistory].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return b.startDate.getTime() - a.startDate.getTime()
  })
  const inferredIndustries = inferIndustriesFromWorkHistory(workHistoryByRecency)
  // "More of the same" default — a guess at the pivot target, not a
  // separate inference pass. Editable right here via SearchStrategyForm.
  const inferredFunction = profile.primaryFunction ?? null
  const checklist = computeSearchStrategyChecklist({ ...profile, inferredIndustries })

  const completedReferencesCount = profile.references.filter((r) => r.status === 'COMPLETED').length

  // 5 pages, one at a time, like the Market Reality Assessment wizard — no
  // per-page points anymore (see maybeAwardSearchStrategyCompleteBonus);
  // completing all of them awards one SEARCH_STRATEGY_COMPLETE bonus
  // instead. Each page can group more than one independently-completable
  // question set (see WizardStepItem) — e.g. Marketing Plan Willingness and
  // Networking Willingness share a page, but each still unlocks its own
  // destination (My Marketing Plan/LinkedIn, My Network) the moment IT'S
  // answered, not only once both are. Target Role & Company and Blockers &
  // Motivations come first — those are the two Victoria needs before she'll
  // review the strategy at all, so they shouldn't be buried behind an
  // optional page.
  const wizardPages: WizardPage[] = [
    { key: 'target-role', label: 'Target Role & Company', items: [{ key: 'target-role', complete: targetRoleComplete }] },
    {
      key: 'blockers-motivations',
      label: "What's Getting in the Way",
      items: [{ key: 'blockers-motivations', complete: blockersMotivationsComplete }],
    },
    {
      key: 'marketing-networking',
      label: 'Your Marketing & Networking Plan',
      items: [
        {
          key: 'marketing-plan',
          complete: marketingPlanWillingnessComplete,
          unlock: {
            introText: 'Answering Marketing Plan Willingness just unlocked:',
            items: [
              {
                href: '/dashboard/marketing-plan',
                icon: 'megaphone',
                label: 'My Marketing Plan',
                description: 'Draft your narrative and post ideas grounded in your real background.',
              },
              {
                href: '/dashboard/linkedin',
                icon: 'share2',
                label: 'LinkedIn',
                description: 'Generate and post directly to LinkedIn.',
              },
            ],
          },
        },
        {
          key: 'networking',
          complete: networkingWillingnessComplete,
          unlock: {
            introText: 'Answering Networking Willingness just unlocked:',
            items: [
              {
                href: '/dashboard/network',
                icon: 'users',
                label: 'My Network',
                description: 'Outreach scripts calibrated to what you said you were comfortable with.',
              },
            ],
          },
        },
      ],
    },
    {
      key: 'negotiation-compensation',
      label: 'Negotiation, Interview & Compensation Readiness',
      items: [
        { key: 'negotiation-interview', complete: negotiationInterviewComfortComplete },
        { key: 'benefits', complete: benefitsAnswered },
      ],
    },
    {
      key: 'other-ways',
      label: 'Other Ways to Strengthen Your Search',
      items: [
        {
          key: 'board-advisory-willingness',
          complete: boardAdvisoryWillingnessComplete,
          unlock: {
            introText: 'Answering Board Advisory Work just unlocked:',
            items: [
              {
                href: '/dashboard/interim-work#board-advisory-work',
                icon: 'users',
                label: 'Board Advisory Work',
                description: 'Board and consulting opportunities matched to your background.',
              },
            ],
          },
        },
        { key: 'so-far', complete: optionalQuestionsAnswered },
      ],
    },
  ]

  const wizardPageContent = [
    <Card key="target-role">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Target Role &amp; Company</CardTitle>
          {targetRoleComplete && (
            <span className="text-success" aria-hidden>
              ✓
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {targetRoleComplete && (
          <p className="text-sm text-muted-foreground">
            Update this any time your target changes — a new role, a new industry, a different
            seniority — and Victoria&apos;s guidance above and your job matches will refresh to
            match.
          </p>
        )}
        <SearchStrategyForm
          profile={profile}
          inferredIndustries={inferredIndustries}
          inferredFunction={inferredFunction}
          completedReferencesCount={completedReferencesCount}
        />
      </CardContent>
    </Card>,

    <Card key="blockers-motivations">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Blockers and Motivations</CardTitle>
          {blockersMotivationsComplete && (
            <span className="text-success" aria-hidden>
              ✓
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {blockersMotivationsComplete
            ? "Update this any time it changes — Victoria's guidance above and her tone with you refresh to match."
            : "Required, alongside Your Target Role & Company, before Victoria will review your strategy — what's actually in your way, and what's pulling you forward, shapes her advice as much as your target role does."}
        </p>
        <PersonalContextForm profile={profile} />
      </CardContent>
    </Card>,

    <div key="marketing-networking" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marketing Plan Willingness</CardTitle>
            {marketingPlanWillingnessComplete && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {marketingPlanWillingnessComplete
              ? 'Update this any time your comfort level changes — it unlocks My Marketing Plan and the LinkedIn post generator.'
              : "What you're willing to do publicly shapes your Marketing Plan and unlocks the LinkedIn post generator — answer these once here instead of hitting two separate locked pages."}
          </p>
          <MarketingPlanWillingnessForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Networking Willingness</CardTitle>
            {networkingWillingnessComplete && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {networkingWillingnessComplete
              ? 'Update this any time it changes — it unlocks My Network and calibrates your outreach scripts.'
              : "What you're willing to do to reach out — and what's holding you back — shapes your outreach scripts and unlocks My Network."}
          </p>
          <NetworkingWillingnessForm profile={profile} />
        </CardContent>
      </Card>
    </div>,

    <div key="negotiation-compensation" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Negotiation &amp; Interview Comfort
            </CardTitle>
            {negotiationInterviewComfortComplete && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {negotiationInterviewComfortComplete
              ? 'Update this any time it changes — a low score shapes the skills we suggest and the career-advice videos we surface first.'
              : "Where you're genuinely comfortable and where you're not, so the skills we suggest and the videos we surface actually target the gap."}
          </p>
          <NegotiationInterviewComfortForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compensation &amp; Benefits</CardTitle>
            {benefitsAnswered && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            What matters to you beyond salary — helps your coach and recruiter contacts steer you
            toward roles and offers that actually fit.
          </p>
          {benefitsAnswered ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-success" aria-hidden>
                ✓
              </span>
              Answered
            </p>
          ) : (
            <BenefitsPrioritiesForm targetCompMin={profile.targetCompMin} />
          )}
        </CardContent>
      </Card>
    </div>,

    <div key="other-ways" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Board Advisory Work Willingness</CardTitle>
            {boardAdvisoryWillingnessComplete && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {boardAdvisoryWillingnessComplete
              ? 'Update this any time — it unlocks Board Advisory Work, matched to your background.'
              : 'Are you willing to take unpaid board positions to fill in resume gaps, keep skills current, and build new experience?'}
          </p>
          <BoardAdvisoryWillingnessForm initial={profile.boardAdvisoryWillingness} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Few More Details</CardTitle>
            {optionalQuestionsAnswered && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {optionalQuestionsAnswered && (
            <p className="text-sm text-muted-foreground">
              Update any answer below as your search progresses — Victoria&apos;s guidance above
              refreshes based on what you report here.
            </p>
          )}
          <OptionalQuestionsForm
            initial={{
              networkingLevel: profile.networkingLevel,
              learnedNewSkillsLevel: profile.learnedNewSkillsLevel,
              triedPartTimeOrConsulting: profile.triedPartTimeOrConsulting,
              triedExecutiveCoaching: profile.triedExecutiveCoaching,
              connectedWithRecruiters: profile.connectedWithRecruiters,
              recruiterConnectionCount: profile.recruiterConnectionCount,
            }}
          />
        </CardContent>
      </Card>
    </div>,
  ]

  const actionPlanCard = checklist.incomplete.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Action Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {checklist.totalPointsRemaining} points left to complete — answer these below to sharpen your matches
          and guidance.
        </p>
        <ul className="space-y-1.5">
          {checklist.incomplete.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <Link href={item.href} className="text-sm text-primary underline underline-offset-4">
                {item.label}
              </Link>
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
                {item.points} pts
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Search Strategy</h1>
        <p className="mt-1 text-muted-foreground">
          A one-time setup for your Search Goals — editable any time your situation changes.
        </p>
        {!hasAnsweredOnce && (
          <p className="text-sm text-muted-foreground">
            Once you&apos;ve answered Your Target Role &amp; Company and Blockers and Motivations
            below, Victoria will review your search strategy and give you personalized feedback
            right here on this page.
          </p>
        )}
        <PageHeaderBoxes pageKey="search-strategy" candidateId={profile.id} />
      </div>

      <div className="space-y-4">
        {hasAnsweredOnce ? (
          <Suspense fallback={<SearchStrategyGuidanceSkeleton />}>
            <SearchStrategyGuidanceCard profile={profile} checklist={checklist} />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <SearchStrategyGuidanceTrigger profile={profile} />
          </Suspense>
        )}
      </div>

      {actionPlanCard}

      <SearchStrategyWizard pages={wizardPages} candidateId={profile.id}>
        {wizardPageContent}
      </SearchStrategyWizard>

      {stage === 'QUIETLY_LOOKING' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">While You&apos;re Still Employed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Being a Good Leaver</p>
              <p className="mt-1 text-muted-foreground">
                Give proper notice, document your work, and stay professional through the exit.
                Ask for a reference or recommendation while goodwill is highest — a good exit is
                what makes a strong reference possible later.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Pre-Departure Benefits Checklist</p>
              <p className="mt-1 text-muted-foreground">
                While you&apos;re still employed: FSA spend-down deadlines, 401(k) match/vesting
                timing, PTO payout rules, stock option exercise windows, requesting documentation
                while you still can, and COBRA timing. General information, not personalized
                advice.
              </p>
            </div>
            <Link
              href="/resources/pre-exit"
              className="inline-block text-sm text-primary underline underline-offset-4"
            >
              Read the full Before You Go guide →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
