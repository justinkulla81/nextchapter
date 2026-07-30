import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getSearchStage, SEARCH_STAGE_MESSAGE } from '@/lib/search-strategy'
import { getOrDraftSearchStrategyGuidance } from '@/lib/reports/search-strategy-guidance'
import { regenerateSearchStrategyGuidance } from '@/app/dashboard/search-strategy/actions'
import { SearchStrategyForm } from '@/components/dashboard/SearchStrategyForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function SearchStrategyPage() {
  const profile = await getDashboardData()
  const stage = getSearchStage(profile)
  const showSkillsNeeded = !(profile.functionSkillConfidence === 100 && profile.aiFlexibilityLevel === 100)
  const strategyGuidance = await getOrDraftSearchStrategyGuidance(profile.id)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search Strategy</h1>
        <p className="mt-1 text-muted-foreground">
          A one-time setup for your Search Goals — editable any time your situation changes.
        </p>
      </div>

      {stage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Search Stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground">{SEARCH_STAGE_MESSAGE[stage]}</p>
            {stage === 'QUIETLY_LOOKING' && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div>
                  <p className="font-medium text-foreground">Being a Good Leaver</p>
                  <p className="mt-1 text-muted-foreground">
                    Give proper notice, document your work, and stay professional through the
                    exit. Ask for a reference or recommendation while goodwill is highest — a
                    good exit is what makes a strong reference possible later.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Pre-Departure Benefits Checklist</p>
                  <p className="mt-1 text-muted-foreground">
                    While you&apos;re still employed: FSA spend-down deadlines, 401(k)
                    match/vesting timing, PTO payout rules, stock option exercise windows,
                    requesting documentation while you still can, and COBRA timing. General
                    information, not personalized advice.
                  </p>
                </div>
                <Link
                  href="/resources/pre-exit"
                  className="inline-block text-sm text-primary underline underline-offset-4"
                >
                  Read the full Before You Go guide →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Search Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchStrategyForm profile={profile} showSkillsNeeded={showSkillsNeeded} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Strategy Guidance</CardTitle>
          {strategyGuidance && (
            <form action={regenerateSearchStrategyGuidance}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Regenerating…">
                Regenerate guidance
              </SubmitButton>
            </form>
          )}
        </CardHeader>
        <CardContent>
          {strategyGuidance ? (
            <p className="text-foreground">{strategyGuidance}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Fill in your target role or function above in Your Search Goals, then come back — we&apos;ll
              turn your goals into specific strategic guidance here.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Build Your Narrative</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When you&apos;re unemployed, sometimes it&apos;s hard to know what you should tell
            others. Build your narrative here so you have a story that makes sense based on your
            background, work gap, and goals.
          </p>
          <Link
            href="/dashboard/interview-prep"
            className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
          >
            Build your narrative here →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
