'use client'

import { useActionState, useState } from 'react'
import { confirmSalary } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmHint } from '@/components/dashboard/ConfirmHint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { cn } from '@/lib/utils'

const POINTS = estimateActionEffort({ actionType: 'SALARY_CONFIRM' }).points

export function SalaryConfirmForm({
  lastSalary,
  confirmedAt,
}: {
  lastSalary: number | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmSalary, undefined)

  const initialSalaryThousands = lastSalary ? String(Math.round(lastSalary / 1000)) : ''
  const [salaryThousands, setSalaryThousands] = useState(initialSalaryThousands)

  const isConfirmed = !!confirmedAt
  const isDeclined = isConfirmed && lastSalary === null
  const isDirty = salaryThousands !== initialSalaryThousands
  const canConfirm = !isConfirmed || isDirty

  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <ConfirmHint show={!isConfirmed} />
      <div className="space-y-1">
        <Label htmlFor="lastSalaryThousands">Last salary</Label>
        <div className="flex items-center gap-2">
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="lastSalaryThousands"
              name="lastSalaryThousands"
              type="number"
              min={0}
              placeholder="120"
              className="pl-7"
              value={salaryThousands}
              onChange={(e) => setSalaryThousands(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            ,000 — e.g. enter <span className="font-medium text-foreground">120</span> for $120,000
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Never shared with a recruiter or shown publicly — used only to match jobs and calibrate level.
        </p>
      </div>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={canConfirm ? 'outline' : 'ghost'} disabled={pending || !canConfirm}>
          {pending ? 'Saving…' : isDeclined ? 'Declined' : isConfirmed ? (isDirty ? 'Reconfirm' : 'Confirmed') : 'Confirm'}
        </Button>
        {!isConfirmed && (
          <Button type="submit" name="declineToAnswer" value="1" size="sm" variant="ghost" disabled={pending}>
            Prefer not to say
          </Button>
        )}
        {!isConfirmed && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{POINTS} pts</span>}
      </div>
    </form>
  )
}
