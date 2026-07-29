import Link from 'next/link'
import { WeeklyEngineChecklist } from '@/components/dashboard/WeeklyEngineChecklist'
import { CATEGORY_MINIMUM_ENFORCED_FROM_WEEK } from '@/lib/scoring/grade'
import type { Grade, WeeklyEngine } from '@/lib/scoring/grade'

// Sits above the locked A-List teaser cards on the Jobs page so a candidate
// sees exactly what's blocking their A, instead of a wall of "reach an A
// grade" teasers with no path to act on it.
export function UnlockAListCallout({
  grade,
  lockedCount,
  weeklySprintsCount,
  engines,
  laggingEngines,
}: {
  grade: Grade
  lockedCount: number
  weeklySprintsCount: number
  engines: WeeklyEngine[]
  laggingEngines: WeeklyEngine['key'][]
}) {
  const opportunityWord = lockedCount === 1 ? 'opportunity' : 'opportunities'
  const headline = `${lockedCount} A-List-exclusive ${opportunityWord} unlock at an A grade — you're currently a ${grade}.`

  return (
    <div className="space-y-2 rounded-lg border border-orange/30 bg-orange/5 p-4">
      <p className="text-sm font-medium text-foreground">{headline}</p>
      {weeklySprintsCount < CATEGORY_MINIMUM_ENFORCED_FROM_WEEK ? (
        <p className="text-sm text-muted-foreground">
          Keep building across all four weekly areas — Learning, Effort, Working, and Connecting
          — to raise your grade.
        </p>
      ) : laggingEngines.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">This week, real work is still needed in:</p>
          <WeeklyEngineChecklist engines={engines} laggingEngines={laggingEngines} />
          <p className="text-sm font-medium text-foreground">
            Your grade is capped at B until every engine clears the bar.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          You&apos;re covering all four weekly areas — keep it up and your grade will catch up.
        </p>
      )}
      <Link
        href="/dashboard"
        className="inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        See this week&apos;s plan →
      </Link>
    </div>
  )
}
