import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getCurrentWeekSprint, getSuggestedActions, type CommittedAction } from '@/lib/weekly/sprint'
import { SprintSetupForm } from '@/components/dashboard/SprintSetupForm'

export default async function SprintSetupPage() {
  const profile = await getDashboardData()
  const [currentSprint, suggestedActions] = await Promise.all([
    getCurrentWeekSprint(profile.id),
    getSuggestedActions(profile.id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">This Week&apos;s Success Sprint</h1>
        <p className="mt-1 text-muted-foreground">
          Choose the actions you&apos;re committing to this week, and rate how hard each one feels right now.
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
        <SprintSetupForm suggestedActions={suggestedActions} />
      )}

      {currentSprint && (
        <div className="border-t border-border pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">Currently committed</h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {(currentSprint.committedActions as unknown as CommittedAction[]).map((a, i) => (
              <li key={i}>
                {a.completed ? '✓ ' : '— '}
                {a.text} (difficulty {a.difficulty}/3)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
