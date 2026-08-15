'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/support/admin/(portal)/coaching-rates/actions'
import { COACH_SESSION_TYPES, COACH_SESSION_TYPE_LABELS } from '@/lib/constants/coach-session-type'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function RateCardForm({
  action,
  coaches,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  coaches: { id: string; fullName: string }[]
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn(
        'grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="sessionType">Session type</Label>
        <select
          id="sessionType"
          name="sessionType"
          required
          defaultValue="STANDARD"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {COACH_SESSION_TYPES.map((type) => (
            <option key={type} value={type}>
              {COACH_SESSION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rateDollars">Rate ($)</Label>
        <Input id="rateDollars" name="rateDollars" type="number" min={0} step="0.01" required placeholder="110" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="effectiveDate">Effective date</Label>
        <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={todayIso()} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="coachId">Applies to</Label>
        <select id="coachId" name="coachId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Default rate (all coaches)</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.fullName} (override)
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 sm:col-span-4">
        {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
        <SubmitButton pendingLabel="Adding…">Add rate</SubmitButton>
      </div>
    </form>
  )
}
