import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toggleSprintAction } from '@/app/dashboard/sprint/actions'
import type { CommittedAction } from '@/lib/weekly/sprint'

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Easy',
  2: 'Some effort',
  3: 'Genuinely hard',
}

export function SuccessSprintCard({ actions }: { actions: CommittedAction[] | null }) {
  if (!actions || actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">This Week&apos;s Success Sprint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t set this week&apos;s goals yet — commit to a few actions and Victoria will track them.
          </p>
          <Button render={<Link href="/dashboard/sprint" />}>Set this week&apos;s goals</Button>
        </CardContent>
      </Card>
    )
  }

  const completedCount = actions.filter((a) => a.completed).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          This Week&apos;s Success Sprint — {completedCount} of {actions.length} done
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action, i) => (
          <form key={i} action={toggleSprintAction.bind(null, i)} className="flex items-center gap-3">
            <button
              type="submit"
              aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
              className="flex size-5 shrink-0 items-center justify-center rounded border border-input data-checked:border-primary data-checked:bg-primary"
              data-checked={action.completed || undefined}
            >
              {action.completed && <span className="text-xs text-primary-foreground">✓</span>}
            </button>
            <span className={`text-sm ${action.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {action.text}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {DIFFICULTY_LABEL[action.difficulty]}
            </span>
          </form>
        ))}
      </CardContent>
    </Card>
  )
}
