import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ACTION_TYPE_LINK, formatMinutes } from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'

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
  const totalPoints = actions.reduce((sum, a) => sum + a.points, 0)
  const totalMinutes = actions.reduce((sum, a) => sum + a.estimatedMinutes, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">This Week&apos;s Success Sprint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">
          You&apos;ve selected <span className="font-semibold">{actions.length}</span> activities for{' '}
          <span className="font-semibold">{totalPoints} points</span>. This will take you{' '}
          <span className="font-semibold">{formatMinutes(totalMinutes)}</span>.{' '}
          <Link href="/dashboard/sprint" className="text-primary underline underline-offset-4">
            Click here to add more →
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          {completedCount} of {actions.length} done
        </p>
        <div className="divide-y divide-border">
          {actions.map((action, i) => {
            const link = action.actionType ? ACTION_TYPE_LINK[action.actionType] : undefined
            return (
              <div key={i} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={link?.href ?? '/dashboard/sprint'}
                  className={`text-sm hover:underline ${
                    action.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  {action.completed ? '✓ ' : ''}
                  {action.text}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{action.points} pts</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
