import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getCurrentWeekSprint, getSuggestedActions, type CommittedAction } from '@/lib/weekly/sprint'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { SEARCH_EXECUTION_ENGINE_LABEL, CATEGORY_MINIMUM_ENFORCED_FROM_WEEK } from '@/lib/scoring/grade'
import { SprintSetupForm } from '@/components/dashboard/SprintSetupForm'

export default async function SprintSetupPage() {
  const profile = await getDashboardData()
  const [currentSprint, suggestedActions, grade] = await Promise.all([
    getCurrentWeekSprint(profile.id),
    getSuggestedActions(profile.id),
    computeHireabilityGrade(profile),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">This Week&apos;s Success Sprint</h1>
        <p className="mt-1 text-muted-foreground">
          Choose the actions you&apos;re committing to this week — each shows how long it takes and
          how many points it&apos;s worth.
        </p>
      </div>

      {currentSprint && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          You&apos;ve already committed to goals this week. Submitting below replaces them.{' '}
          <Link href="/dashboard" className="text-primary underline underline-offset-4">
            Back to dashboard
          </Link>
        </div>
      )}

      {suggestedActions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your report is still generating — check back in a moment for suggested actions.
        </p>
      ) : (
        <SprintSetupForm suggestedActions={suggestedActions} marketRealityGrade={grade.marketReality.grade} />
      )}

      {currentSprint && (
        <div className="border-t border-border pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">Currently committed</h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {(currentSprint.committedActions as unknown as CommittedAction[]).map((a, i) => (
              <li key={i}>
                {a.completed ? '✓ ' : '— '}
                {a.text} ({a.points} pts)
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile._count.weeklySprints >= CATEGORY_MINIMUM_ENFORCED_FROM_WEEK && (
        <div className="border-t border-border pt-6">
          <h2 className="text-sm font-medium text-foreground">Week 4+ Requirements</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From here on, an A in Search Execution requires real work across all four engines — not
            just one you&apos;re comfortable with.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {grade.searchExecution.engines.map((e) => (
              <li key={e.key} className="flex items-center gap-2">
                <span>{grade.searchExecution.laggingEngines.includes(e.key) ? '☐' : '☑'}</span>
                <span className="text-foreground">{SEARCH_EXECUTION_ENGINE_LABEL[e.key]}</span>
                {grade.searchExecution.laggingEngines.includes(e.key) && (
                  <span className="text-xs text-muted-foreground">needs real work this week</span>
                )}
              </li>
            ))}
          </ul>
          {!grade.searchExecution.categoryMinimumsMet && (
            <p className="mt-3 text-sm font-medium text-foreground">
              Your grade is capped at B until every engine clears the bar — real effort spread
              across all four, not stacked in one.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
