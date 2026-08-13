import type { Metadata } from 'next'
import type { CandidateProfile } from '@prisma/client'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getSearchStage, isSearchGoalsComplete } from '@/lib/search-strategy'
import { getOrDraftSearchStrategyGuidance, getSearchStrategyActions } from '@/lib/reports/search-strategy-guidance'
import { computeSearchStrategyChecklist, type SearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { SearchStrategyForm } from '@/components/dashboard/SearchStrategyForm'
import { OptionalQuestionsForm } from '@/components/dashboard/OptionalQuestionsForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
async function SearchStrategyGuidanceCard({
  profile,
  checklist,
}: {
  profile: CandidateProfile
  checklist: SearchStrategyChecklist
}) {
  const goalsComplete = isSearchGoalsComplete(profile)
  const strategyGuidance = goalsComplete ? await getOrDraftSearchStrategyGuidance(profile.id) : null

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
  if (isSearchGoalsComplete(profile)) {
    await getOrDraftSearchStrategyGuidance(profile.id)
  }
  return null
}

export default async function SearchStrategyPage() {
  const profile = await getDashboardData()
  const stage = getSearchStage(profile)
  const hasAnsweredOnce = !!profile.searchStrategyFirstAnsweredAt
  // getDashboardData doesn't order workHistory — sort here so the recency
  // tiebreak inside inferIndustriesFromWorkHistory (first-seen index wins)
  // actually reflects most-recent-first, matching onboarding/goals/page.tsx.
  const workHistoryByRecency = [...profile.workHistory].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return b.startDate.getTime() - a.startDate.getTime()
  })
  const inferredIndustries = inferIndustriesFromWorkHistory(workHistoryByRecency)
  // Same "more of the same" default as onboarding/goals/page.tsx — a guess at
  // the pivot target, not a separate inference pass. Editable right there.
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

  const searchStrategySoFarCard = (
    <Card id="optional-questions" className="scroll-mt-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Search Strategy So Far</CardTitle>
          {!optionalQuestionsAnswered && (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              +5 pts
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {optionalQuestionsAnswered ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-success" aria-hidden>
              ✓
            </span>
            Answered
          </p>
        ) : (
          <OptionalQuestionsForm />
        )}
      </CardContent>
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
            Once you&apos;ve answered the questions below, Victoria will review your search strategy
            and give you personalized feedback right here on this page.
          </p>
        )}
        <PageHeaderBoxes pageKey="search-strategy" candidateId={profile.id} />
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Target Role &amp; Company</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchStrategyForm
            profile={profile}
            inferredIndustries={inferredIndustries}
            inferredFunction={inferredFunction}
            completedReferencesCount={completedReferencesCount}
          />
        </CardContent>
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
