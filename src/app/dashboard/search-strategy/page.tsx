import type { Metadata } from 'next'
import type { CandidateProfile } from '@prisma/client'
import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import {
  getSearchStage,
  isSearchGoalsComplete,
  isBlockersAndMotivationsComplete,
  isMarketingPlanWillingnessComplete,
  isNetworkingWillingnessComplete,
} from '@/lib/search-strategy'
import { getOrDraftSearchStrategyGuidance, getSearchStrategyActions } from '@/lib/reports/search-strategy-guidance'
import { computeSearchStrategyChecklist, type SearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { getCurrentWeekSprint } from '@/lib/weekly/sprint'
import { VisibilityComfortCard } from '@/components/dashboard/VisibilityComfortCard'
import { SearchStrategyForm } from '@/components/dashboard/SearchStrategyForm'
import { OptionalQuestionsForm } from '@/components/dashboard/OptionalQuestionsForm'
import { PersonalContextForm } from '@/components/dashboard/PersonalContextForm'
import { MarketingPlanWillingnessForm } from '@/components/dashboard/MarketingPlanWillingnessForm'
import { NetworkingWillingnessForm } from '@/components/dashboard/NetworkingWillingnessForm'
import { BenefitsPrioritiesForm } from '@/components/dashboard/BenefitsPrioritiesForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { inferIndustriesFromWorkHistory } from '@/lib/onboarding/infer-industries'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

export const metadata: Metadata = { title: 'My Search Strategy' }

// getOrDraftSearchStrategyGuidance makes a direct, uncached (on this specific
// profile) Anthropic call whenever the draft is missing or was invalidated
// by a Search Goals save — isolated in its own Suspense boundary so the rest
// of the page renders immediately regardless of how long guidance takes.
// Only mounted once the candidate has seen Victoria's guidance at least once
// (see hasAnsweredOnce in SearchStrategyPage below) — before that, drafting
// happens silently via SearchStrategyGuidanceTrigger instead, with no
// Victoria-branded card on screen yet.
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

  const missingSections = [
    !targetRoleComplete && 'Your Target Role & Company',
    !blockersMotivationsComplete && 'Blockers and Motivations',
  ].filter((v): v is string => !!v)

  return (
    <Card className="border-brand/20 bg-brand/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <VictoriaAvatar size={36} />
          <CardTitle className="text-sm font-medium text-foreground">Strategy Guidance from Victoria</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {strategyGuidance ? (
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-success uppercase">What&apos;s working</p>
                <p className="mt-1 text-foreground">{strategyGuidance.pros}</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-warning uppercase">What to watch</p>
                <p className="mt-1 text-foreground">{strategyGuidance.cons}</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-brand uppercase">What I&apos;d change</p>
                <p className="mt-1 text-foreground">{strategyGuidance.suggestedChanges}</p>
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
            <div>
              <p className="text-xs font-medium text-muted-foreground">Specific actions to take:</p>
              <div className="mt-1.5 flex flex-col gap-2">
                {getSearchStrategyActions(profile).map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    {action.label} →
                  </Link>
                ))}
              </div>
            </div>
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
      </CardContent>
    </Card>
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
  const networkingWillingnessComplete = isNetworkingWillingnessComplete(profile)
  const benefitsAnswered = !!profile.benefitsPrioritiesBonusAt
  const benefitsPoints = estimateActionEffort({ actionType: 'BENEFITS_PRIORITIES_CONFIRMED' }).points
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

  // Mirrors fetchCompletion's optionalQuestionsAnswered check in
  // profile-checklist.ts — kept in sync manually since this page reads the
  // fields directly off the already-fetched profile instead of a second query.
  const optionalQuestionsAnswered = [
    profile.jobsAppliedBucket,
    profile.interviewsReceivedCount,
    profile.networkingLevel,
    profile.learnedNewSkillsLevel,
    profile.triedPartTimeOrConsulting,
    profile.triedExecutiveCoaching,
    profile.connectedWithRecruiters,
  ].every((f) => f !== null)

  const completedReferencesCount = profile.references.filter((r) => r.status === 'COMPLETED').length
  const currentSprint = await getCurrentWeekSprint(profile.id)

  const searchStrategySoFarCard = (
    <Card id="optional-questions" className="scroll-mt-4 overflow-hidden p-0">
      <details className="group" open={!optionalQuestionsAnswered}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-6 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Search Strategy So Far</CardTitle>
            {optionalQuestionsAnswered && (
              <span className="text-success" aria-hidden>
                ✓
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!optionalQuestionsAnswered && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">+5 pts</span>
            )}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </div>
        </summary>
        <CardContent className="space-y-4 border-t border-border pt-4">
          {optionalQuestionsAnswered && (
            <p className="text-sm text-muted-foreground">
              Update any answer below as your search progresses — Victoria&apos;s guidance above
              refreshes based on what you report here.
            </p>
          )}
          <OptionalQuestionsForm
            initial={{
              jobsAppliedBucket: profile.jobsAppliedBucket,
              interviewsReceivedCount: profile.interviewsReceivedCount,
              networkingLevel: profile.networkingLevel,
              learnedNewSkillsLevel: profile.learnedNewSkillsLevel,
              triedPartTimeOrConsulting: profile.triedPartTimeOrConsulting,
              triedExecutiveCoaching: profile.triedExecutiveCoaching,
              connectedWithRecruiters: profile.connectedWithRecruiters,
              recruiterConnectionCount: profile.recruiterConnectionCount,
            }}
          />
        </CardContent>
      </details>
    </Card>
  )

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

      {/* Moved here from the main dashboard — this is a weekly re-check of
          the same underlying comfort value the onboarding "Search Strategy
          Willingness" questions ask once (see PUBLIC_DISCLOSURE_COMFORT_OPTIONS),
          so it belongs alongside them rather than on the dashboard. Kept as
          a real recurring check-in (not deleted) since it feeds the
          sentiment trend Coaching Notes and visibility calibration read —
          the one-time onboarding answer alone can't show whether comfort is
          changing week to week. */}
      <VisibilityComfortCard initialComfort={currentSprint?.visibilityComfort ?? null} />

      {hasAnsweredOnce ? (
        <Suspense fallback={<SearchStrategyGuidanceSkeleton />}>
          <SearchStrategyGuidanceCard profile={profile} checklist={checklist} />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <SearchStrategyGuidanceTrigger profile={profile} />
        </Suspense>
      )}

      {searchStrategySoFarCard}

      {actionPlanCard}

      <Card className="overflow-hidden p-0">
        <details className="group" open={!targetRoleComplete}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-6 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Your Target Role &amp; Company</CardTitle>
              {targetRoleComplete && (
                <span className="text-success" aria-hidden>
                  ✓
                </span>
              )}
            </div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="space-y-4 border-t border-border pt-4">
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
        </details>
      </Card>

      <Card className="overflow-hidden p-0">
        <details className="group" open={!blockersMotivationsComplete}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-6 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Blockers and Motivations</CardTitle>
              {blockersMotivationsComplete && (
                <span className="text-success" aria-hidden>
                  ✓
                </span>
              )}
            </div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="space-y-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {blockersMotivationsComplete
                ? "Update this any time it changes — Victoria's guidance above and her tone with you refresh to match."
                : "Required, alongside Your Target Role & Company above, before Victoria will review your strategy — what's actually in your way, and what's pulling you forward, shapes her advice as much as your target role does."}
            </p>
            <PersonalContextForm profile={profile} />
          </CardContent>
        </details>
      </Card>

      <Card className="overflow-hidden p-0">
        <details className="group" open={!marketingPlanWillingnessComplete}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-6 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Marketing Plan Willingness</CardTitle>
              {marketingPlanWillingnessComplete && (
                <span className="text-success" aria-hidden>
                  ✓
                </span>
              )}
            </div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="space-y-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {marketingPlanWillingnessComplete
                ? 'Update this any time your comfort level changes — it unlocks My Marketing Plan and the LinkedIn post generator.'
                : "What you're willing to do publicly shapes your Marketing Plan and unlocks the LinkedIn post generator — answer these once here instead of hitting two separate locked pages."}
            </p>
            <MarketingPlanWillingnessForm profile={profile} />
          </CardContent>
        </details>
      </Card>

      <Card className="overflow-hidden p-0">
        <details className="group" open={!networkingWillingnessComplete}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-6 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Networking Willingness</CardTitle>
              {networkingWillingnessComplete && (
                <span className="text-success" aria-hidden>
                  ✓
                </span>
              )}
            </div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="space-y-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {networkingWillingnessComplete
                ? 'Update this any time it changes — it unlocks My Network and calibrates your outreach scripts.'
                : "What you're willing to do to reach out — and what's holding you back — shapes your outreach scripts and unlocks My Network."}
            </p>
            <NetworkingWillingnessForm profile={profile} />
          </CardContent>
        </details>
      </Card>

      <Card id="comp-benefits" className="scroll-mt-4 overflow-hidden p-0">
        <details className="group" open={!benefitsAnswered}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-6 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compensation &amp; Benefits
              </CardTitle>
              {benefitsAnswered && (
                <span className="text-success" aria-hidden>
                  ✓
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!benefitsAnswered && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  +{benefitsPoints} pts
                </span>
              )}
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </div>
          </summary>
          <CardContent className="space-y-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              What matters to you beyond salary — helps your coach and recruiter contacts steer
              you toward roles and offers that actually fit.
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
        </details>
      </Card>

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
