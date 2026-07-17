'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ACTION_TYPE_LINK, formatMinutes, type SuggestedActionLike } from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'
import type { Grade } from '@/lib/scoring/grade'
import { toggleSprintAction } from '@/app/dashboard/sprint/actions'
import { SprintSetupForm } from '@/components/dashboard/SprintSetupForm'

interface SuggestedAction extends SuggestedActionLike {
  text: string
}

export function SuccessSprintCard({
  actions,
  suggestedActions,
  marketRealityGrade,
  weekNumber,
  editWindowOpen,
}: {
  actions: CommittedAction[] | null
  suggestedActions: SuggestedAction[]
  marketRealityGrade: Grade
  weekNumber: number
  editWindowOpen: boolean
}) {
  const [showSetup, setShowSetup] = useState(!actions || actions.length === 0)

  const completedCount = actions?.filter((a) => a.completed).length ?? 0
  const totalPoints = actions?.reduce((sum, a) => sum + a.points, 0) ?? 0
  const totalMinutes = actions?.reduce((sum, a) => sum + a.estimatedMinutes, 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Search Sprint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {actions && actions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              You&apos;ve committed to <span className="font-semibold">{actions.length}</span> actions for{' '}
              <span className="font-semibold">{totalPoints} points</span>. This will take you{' '}
              <span className="font-semibold">{formatMinutes(totalMinutes)}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {actions.length} done
            </p>
            <div className="space-y-1.5">
              {actions.map((action, i) => {
                const link = action.actionType ? ACTION_TYPE_LINK[action.actionType] : undefined
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-off-white px-3 py-2"
                  >
                    <Link
                      href={link?.href ?? '/dashboard'}
                      className={`text-sm hover:underline ${
                        action.completed && !action.recurring
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                    >
                      {action.completed && !action.recurring ? '✓ ' : ''}
                      {action.text}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{action.points} pts</span>
                      {action.recurring ? (
                        action.completed ? (
                          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                            Started
                          </span>
                        ) : (
                          <form action={toggleSprintAction.bind(null, i)}>
                            <SubmitButton variant="outline" size="sm">
                              Mark started
                            </SubmitButton>
                          </form>
                        )
                      ) : (
                        <form action={toggleSprintAction.bind(null, i)}>
                          <SubmitButton variant={action.completed ? 'ghost' : 'outline'} size="sm">
                            {action.completed ? 'Mark not done' : 'Mark done'}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {editWindowOpen && !showSetup && (
          <Button variant="ghost" size="sm" onClick={() => setShowSetup(true)} className="cursor-pointer">
            Update this week&apos;s actions →
          </Button>
        )}

        {showSetup &&
          (suggestedActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your report is still generating — check back in a moment for suggested actions.
            </p>
          ) : (
            <SprintSetupForm
              suggestedActions={suggestedActions}
              marketRealityGrade={marketRealityGrade}
              weekNumber={weekNumber}
              locked={!editWindowOpen}
            />
          ))}
      </CardContent>
    </Card>
  )
}
