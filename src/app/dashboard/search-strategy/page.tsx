import { captureServerEvent } from '@/lib/posthog/server'
import { getUnlockStatus } from '@/lib/effort/load'
import { UnlockProgress } from '@/components/effort/UnlockProgress'
import { unlockNextStrategy } from './unlock-actions'
import { IndustryRealityCheck } from '@/components/dashboard/pathway/IndustryRealityCheck'
import { parseRelocation } from '@/lib/journey/relocation'
import { activeTargets, pivotOf } from '@/lib/journey/pivot'
import { careerOf, isCareerAnswered } from '@/lib/journey/career'
import { CareerGoalsForm } from '@/components/dashboard/CareerGoalsForm'
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
import { SearchStrategyWizard, type WizardPage } from '@/components/dashboard/SearchStrategyWizard'
import { SearchStrategyForm } from '@/components/dashboard/SearchStrategyForm'
import { EmployerSectorFilter } from '@/components/dashboard/EmployerSectorFilter'
import { shownFromHidden } from '@/lib/jobs/employer-sector'
import { PersonalContextForm } from '@/components/dashboard/PersonalContextForm'
import { MarketingNetworkingForm } from '@/components/dashboard/MarketingNetworkingForm'
import { NegotiationCompensationForm } from '@/components/dashboard/NegotiationCompensationForm'
import { OtherSearchStrengthenersForm } from '@/components/dashboard/OtherSearchStrengthenersForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { CultureFitForm } from '@/components/dashboard/CultureFitForm'
import { parseCultureFit } from '@/lib/culture/culture-fit'
import { Spinner } from '@/components/ui/spinner'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { inferIndustriesFromWorkHistory } from '@/lib/onboarding/infer-industries'
import { getCulturePreferences } from '@/lib/companies/culture-profile'
import { CulturePreferencesForm } from '@/components/companies/CultureSurvey'
import { getPlatform } from '@/lib/platforms/directory'
import type { PlatformStageKey } from '@/lib/platforms/stages'
import { parseIndependentWorkExperience, suggestIndependentWork } from '@/lib/independent-work/experience'
import { PivotPathsTeaser } from '@/components/dashboard/pivots/PivotPathsTeaser'
import { MarketSizeSection } from '@/components/dashboard/MarketSizeSection'
import { IndustryReadingConfirm } from '@/components/dashboard/IndustryReadingConfirm'
import { AddCityPrompt } from '@/components/dashboard/AddCityPrompt'
import { US_STATE_CODES } from '@/lib/pay/market-pay'
import { readMemberIndustries } from '@/lib/profile/industry-reading'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'

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

async function SearchStrategyGuidanceCard({ profile }: { profile: CandidateProfile }) {
  const targetRoleComplete = isSearchGoalsComplete(profile)
  const blockersMotivationsComplete = isBlockersAndMotivationsComplete(profile)
  const goalsComplete = targetRoleComplete && blockersMotivationsComplete
  // The guidance draft can take a while (it may call the model); the rejection
  // lookup is independent, so run them together.
  const strategyGuidancePromise = goalsComplete ? getOrDraftSearchStrategyGuidance(profile.id) : Promise.resolve(null)

  // Independent of Search Goals completion — a candidate can have logged
  // rejections before finishing their profile. Read-only from the same
  // report-generation-time computation as the Market Reality page's
  // Rejection Patterns section (computeRejectionTrends), never a second
  // live computation.
  const [strategyGuidance, latestReportForRejections] = await Promise.all([
    strategyGuidancePromise,
    prisma.marketRealityReport.findFirst({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'desc' },
      select: { jobSearchPattern: true },
    }),
  ])
  const rejectionTrends =
    (latestReportForRejections?.jobSearchPattern as unknown as { rejectionTrends: RejectionTrendsData | null } | null)
      ?.rejectionTrends ?? null

  const missingSections = [
    !targetRoleComplete && 'Your Target Role & Company',
    !blockersMotivationsComplete && 'Blockers and Motivations',
  ].filter((v): v is string => !!v)

  if (!strategyGuidance) {
    return (
      <section aria-labelledby="victoria" className="space-y-2 rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <VictoriaAvatar size={36} />
          <h2 id="victoria" className="font-serif text-xl font-semibold text-navy">Victoria&apos;s read</h2>
        </div>
        <p className="text-base text-muted-foreground">
          {missingSections.length > 0
            ? `Answer ${missingSections.join(' and ')} below and Victoria will write your read.`
            : 'Victoria is updating your read from your latest answers. Check back in a moment.'}
        </p>
      </section>
    )
  }

  const rejectionGroups = rejectionTrends?.eligible
    ? [
        { label: 'Company size', breakdown: rejectionTrends.companySizeBreakdown },
        { label: 'Industry', breakdown: rejectionTrends.industryBreakdown },
        { label: 'Function', breakdown: rejectionTrends.functionBreakdown },
        { label: 'Level fit', breakdown: rejectionTrends.levelFitBreakdown },
      ].filter((g) => g.breakdown && g.breakdown.length > 0)
    : []

  return (
    <section aria-labelledby="victoria" className="space-y-4 rounded-2xl border border-border bg-white p-6">
      <div className="flex items-center gap-3">
        <VictoriaAvatar size={36} />
        <h2 id="victoria" className="font-serif text-xl font-semibold text-navy">Victoria&apos;s read</h2>
      </div>
      <div>
        <p className="text-sm font-semibold text-navy">What I&apos;d change</p>
        <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-base text-foreground">
          {strategyGuidance.suggestedChanges.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4">What&apos;s working and what to watch</summary>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold text-navy">What&apos;s working</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-foreground">
              {strategyGuidance.pros.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-navy">What to watch</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-foreground">
              {strategyGuidance.cons.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
        {rejectionGroups.length > 0 && (
          <div className="mt-4 text-sm">
            <p className="font-semibold text-navy">Rejection patterns</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-foreground">
              {rejectionGroups.map((group) => (
                <li key={group.label}>
                  <span className="font-medium">{group.label}:</span> {group.breakdown!.map((b) => `${b.label} (${b.count})`).join(', ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </section>
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
async function StrategyUnlockCard({ candidateId }: { candidateId: string }) {
  const status = await getUnlockStatus(candidateId)
  captureServerEvent(candidateId, 'unlock_progress_viewed', { points: status.score.total, bar: status.bar.points, unlocked: status.unlocked, workKinds: status.score.workKinds })
  return (
    <UnlockProgress
      status={status}
      title="Unlock your next strategy and report refresh"
      what="Victoria writes a new read of your strategy, and your Market Reality Report is refreshed with it, from the work you have done since the last one: who you talked to, what you applied for, what you learned and what you told us. Earn strategy credits with effort, not time alone."
      action={unlockNextStrategy}
      buttonLabel="Generate my next strategy"
      pendingLabel="Writing your strategy…"
      event="next_strategy_unlock_clicked"
    />
  )
}

async function SearchStrategyGuidanceTrigger({ profile }: { profile: CandidateProfile }) {
  if (isSearchGoalsComplete(profile) && isBlockersAndMotivationsComplete(profile)) {
    await getOrDraftSearchStrategyGuidance(profile.id)
  }
  return null
}

export default async function SearchStrategyPage() {
  const profile = await getDashboardData()
  const culturePreferencesPromise = getCulturePreferences(profile.id)
  // Pre-fill the independent-work question from what email and logged work
  // already show, so the candidate confirms instead of answering from scratch.
  const platformRowsPromise = prisma.candidatePlatformActivity.findMany({
    where: { candidateId: profile.id, kind: 'WORK' },
    select: { platformKey: true, stage: true, lastProgressAt: true, dismissedAt: true },
  })
  const [culturePreferences, platformRows] = await Promise.all([culturePreferencesPromise, platformRowsPromise])
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

  const independentWorkInitial = parseIndependentWorkExperience(profile.independentWorkExperience)
  const independentWorkSuggestions = suggestIndependentWork(
    platformRows.flatMap((r) => {
      const platform = getPlatform(r.platformKey)
      return platform
        ? [{ name: platform.name, category: platform.category, stage: r.stage as PlatformStageKey, lastProgressAt: r.lastProgressAt, dismissed: !!r.dismissedAt }]
        : []
    }),
    profile.workHistory
  )

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
  // Culture is part of a search; it is not asked of people who are not looking.
  const stageJourney = effectiveJourney(profile)
  const showCulture = !!stageJourney && getJourney(stageJourney).searching
  const cultureAnswered = parseCultureFit(profile.cultureFit) !== null
  const searchingJourney = !stageJourney || getJourney(stageJourney).searching
  // Staying and promotion members say what they want from their career (src/lib/journey/career.ts).
  const showCareer = stageJourney === 'GROWING' || stageJourney === 'PROMOTION'
  const careerAnswered = isCareerAnswered(careerOf(profile.journeyDetails))
  const allWizardPages: WizardPage[] = [
    ...(showCareer ? [{ key: 'career', label: 'What You Want From Your Career', items: [{ key: 'career', complete: careerAnswered }] }] : []),
    { key: 'target-role', label: 'Target Role & Company', items: [{ key: 'target-role', complete: targetRoleComplete }] },
    {
      key: 'blockers-motivations',
      label: "What's Getting in the Way",
      items: [{ key: 'blockers-motivations', complete: blockersMotivationsComplete }],
    },
    ...(showCulture
      ? [{ key: 'culture', label: 'Culture & Working Environment', items: [{ key: 'culture', complete: cultureAnswered }] }]
      : []),
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
                href: '/dashboard/find-my-job?types=advisory#employer-matched-roles',
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

  const allWizardContent = [
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
          relocation={parseRelocation(profile.journeyDetails, profile.openToRelocation)}
          pivotTargets={activeTargets(pivotOf(profile.journeyDetails))}
          seniorLevel={(profile.levelRankScore ?? 0) >= 60}
          canSwitchJourney={!!stageJourney && stageJourney !== 'CAREER_CHANGE' && getJourney(stageJourney).searching}
          journey={stageJourney}
        />
        <div id="employer-sectors" className="scroll-mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">Which employers do you want jobs from?</p>
          <p className="text-xs text-muted-foreground">
            Turn a sector off and its jobs leave your board and your job emails. You can change this any time, here or on the board.
          </p>
          <EmployerSectorFilter surface="search_strategy" shown={shownFromHidden(profile.hiddenEmployerSectors)} updateUrl={false} />
        </div>
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

    ...(showCulture
      ? [
          <Card key="culture">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Culture &amp; Working Environment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                If it matters to you, we turn it into questions to ask in interviews, checks on an offer and people to ask what a company is really like. If it
                does not matter, we leave it out.
              </p>
              <CultureFitForm fit={parseCultureFit(profile.cultureFit)} />
            </CardContent>
          </Card>,
        ]
      : []),
    <Card key="marketing-networking">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Your Marketing &amp; Networking Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          What you&apos;re willing to do publicly, and how you feel about reaching out — shapes your
          Marketing Plan and outreach scripts, and unlocks My Marketing Plan, LinkedIn, and My
          Network.
        </p>
        <MarketingNetworkingForm profile={profile} />
      </CardContent>
    </Card>,

    <Card key="negotiation-compensation">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Negotiation, Interview &amp; Compensation Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Where you&apos;re genuinely comfortable, and what matters to you beyond salary — shapes
          the skills and videos we surface, and helps your coach and recruiter contacts steer you
          toward offers that fit.
        </p>
        <NegotiationCompensationForm profile={profile} targetCompMin={profile.targetCompMin} />
      </CardContent>
    </Card>,

    <Card key="other-ways">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Other Ways to Strengthen Your Search</CardTitle>
      </CardHeader>
      <CardContent>
        <OtherSearchStrengthenersForm
          boardAdvisoryInitial={profile.boardAdvisoryWillingness}
          independentWorkInitial={independentWorkInitial}
          independentWorkSuggestions={independentWorkSuggestions}
          optionalQuestionsInitial={{
            networkingLevel: profile.networkingLevel,
            learnedNewSkillsLevel: profile.learnedNewSkillsLevel,
            triedExecutiveCoaching: profile.triedExecutiveCoaching,
            connectedWithRecruiters: profile.connectedWithRecruiters,
            recruiterConnectionCount: profile.recruiterConnectionCount,
          }}
        />
      </CardContent>
    </Card>,
    ...(showCareer
      ? [
          <Card key="career">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">What You Want From Your Career</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Your next review, the next level and whether pay or title matters most. Your weekly plan, your case for a review and your pay comparison use it.
              </p>
              <CareerGoalsForm initial={careerOf(profile.journeyDetails)} />
            </CardContent>
          </Card>,
        ]
      : []),
  ]

  // Someone who is not looking for a job is not asked job-search questions: no target role,
  // blockers, culture or "strengthen your search". They keep marketing, networking, negotiation and benefits.
  const SEARCH_ONLY_PAGES = new Set(['target-role', 'blockers-motivations', 'culture', 'other-ways'])
  const keep = (key: string) => searchingJourney || !SEARCH_ONLY_PAGES.has(key)
  const careerFirst = (arr: unknown[], keyOf: (x: never) => string) => [...arr].sort((a, b) => Number(keyOf(b as never) === 'career') - Number(keyOf(a as never) === 'career'))
  const wizardPages = careerFirst(allWizardPages.filter((pg) => keep(pg.key)), (pg: WizardPage) => pg.key) as WizardPage[]
  const wizardPageContent = careerFirst(allWizardContent.filter((el) => keep(String(el.key))), (el: { key: string | null }) => String(el.key)) as typeof allWizardContent

  const incomplete = wizardPages.filter((pg) => !pg.items.every((i) => i.complete))

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {isRedesignOn(profile.email) ? (
        <PageHeader
          title="Your search strategy"
          intro={
            searchingJourney
              ? 'Victoria\u2019s read of where you stand, and the few answers it rests on.'
              : 'What you want from your career, and how you like to work with us. Job-search questions turn on if you start looking.'
          }
          action={
            incomplete.length > 0 ? (
              <ActionLink href="#answers" event="search_strategy_answer_clicked" props={{ remaining: incomplete.length, answeredOnce: hasAnsweredOnce }}>
                {hasAnsweredOnce ? `Answer ${incomplete.length} more` : 'Answer the first questions'}
              </ActionLink>
            ) : undefined
          }
        />
      ) : (
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight text-navy">Your search strategy</h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {searchingJourney
              ? 'Victoria\u2019s read of where you stand, and the few answers it rests on.'
              : 'What you want from your career, and how you like to work with us. Job-search questions turn on if you start looking.'}
          </p>
        </div>
        {incomplete.length > 0 && (
          <a href="#answers" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:brightness-95">
            {hasAnsweredOnce ? `Answer ${incomplete.length} more` : 'Answer the first questions'}
          </a>
        )}
      </header>
      )}

      {searchingJourney &&
        (hasAnsweredOnce ? (
          <Suspense fallback={<SearchStrategyGuidanceSkeleton />}>
            <SearchStrategyGuidanceCard profile={profile} />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <SearchStrategyGuidanceTrigger profile={profile} />
          </Suspense>
        ))}

      <section id="answers" aria-labelledby="answers-title" className="scroll-mt-4 space-y-2">
        <h2 id="answers-title" className="font-serif text-xl font-semibold text-navy">What this rests on</h2>
        <SearchStrategyWizard pages={wizardPages} candidateId={profile.id}>
          {wizardPageContent}
        </SearchStrategyWizard>
      </section>

      {hasAnsweredOnce && (
        <Suspense fallback={null}>
          <StrategyUnlockCard candidateId={profile.id} />
        </Suspense>
      )}

      <MoreDetails summary="More about your search">
      {/* Market-based pivot suggestions (src/lib/pivots): prominent when pivoting or when the member's own work is contracting. */}
      <Suspense fallback={null}>
        <PivotPathsTeaser profile={profile} />
      </Suspense>

      {/* Their industry text read as several industries (or none we know): one-click confirm (industry-reading.ts). */}
      {(() => {
        const text = [profile.industryContext, profile.secondaryIndustryContext].filter(Boolean).join(' / ')
        const reading = readMemberIndustries(profile.industryContext, profile.secondaryIndustryContext)
        if (!text || profile.industryBuckets.length > 0 || !reading.uncertain) return null
        return <IndustryReadingConfirm text={text} suggested={reading.buckets} options={INDUSTRY_BUCKET_NAMES.filter((n) => n !== 'Other')} />
      })()}

      {/* No home city: local jobs can't count (relevance.ts geography). One click to add it. */}
      {(!profile.currentCity?.trim() || !profile.currentState?.trim()) && (
        <AddCityPrompt surface="search_strategy" states={[...US_STATE_CODES].sort()} fallback="remote jobs and places you said you'd move to" />
      )}

      {/* How big the member's target market is, its trend, and next steps (market-size.ts). */}
      <Suspense fallback={null}>
        <MarketSizeSection member={profile} surface="search_strategy" />
      </Suspense>

      {searchingJourney && (
        <Suspense fallback={null}>
          <IndustryRealityCheck candidateId={profile.id} currentIndustry={profile.industryContext} targetIndustries={profile.targetIndustries} fn={profile.targetFunction ?? profile.primaryFunction} />
        </Suspense>
      )}

      {searchingJourney && (
      <Card id="culture-preferences" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Culture you want</CardTitle>
        </CardHeader>
        <CardContent>
          <CulturePreferencesForm initial={culturePreferences} />
        </CardContent>
      </Card>
      )}

      {searchingJourney && stage === 'QUIETLY_LOOKING' && (
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
      </MoreDetails>
    </div>
  )
}
