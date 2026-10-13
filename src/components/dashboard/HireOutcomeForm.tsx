'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  recordHireOutcome,
  saveAgeBand,
  saveLastJobEndedAt,
  type OutcomeFormState,
} from '@/app/dashboard/got-hired/outcome-actions'

const OUTCOME_TYPES = [
  { value: 'PERMANENT', label: 'Full-time role' },
  { value: 'INTERIM', label: 'Interim role' },
  { value: 'FRACTIONAL', label: 'Fractional work' },
  { value: 'ADVISORY', label: 'Advisory or board' },
]

const SOURCES = [
  { value: 'REFERRAL', label: 'A referral or introduction' },
  { value: 'NETWORK_CONVERSATION', label: 'A conversation in my network' },
  { value: 'ALUMNI_OR_MENTOR', label: 'An alumni contact or mentor' },
  { value: 'RECRUITER', label: 'A recruiter' },
  { value: 'INBOUND_APPLICATION', label: 'An application I submitted' },
  { value: 'OTHER', label: 'Something else' },
]

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function LastJobEndedForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState<OutcomeFormState, FormData>(saveLastJobEndedAt, undefined)
  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="space-y-1.5">
        <Label htmlFor="lastJobEndedAt">Last day you worked</Label>
        <Input id="lastJobEndedAt" name="lastJobEndedAt" type="date" defaultValue={current ?? ''} required />
        <p className="text-xs text-muted-foreground">
          We use this to compare your progress with people at the same stage of a search, so a long search is never held
          against you. It stays private.
        </p>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.saved && <p className="text-sm text-foreground">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save last day worked'}
      </Button>
    </form>
  )
}

const AGE_OPTIONS = [
  { value: 'UNDER_35', label: 'Under 35' },
  { value: 'A35_44', label: '35 to 44' },
  { value: 'A45_54', label: '45 to 54' },
  { value: 'A55_64', label: '55 to 64' },
  { value: 'A65_PLUS', label: '65 or older' },
]

export function AgeBandForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState<OutcomeFormState, FormData>(saveAgeBand, undefined)
  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="space-y-1.5">
        <Label htmlFor="ageBand">Age range (optional)</Label>
        <select id="ageBand" name="ageBand" defaultValue={current ?? ''} className={selectClass}>
          <option value="">Prefer not to say</option>
          {AGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Used only to show guidance that fits your situation and to compare you with people in a similar one. It is never used to
          rank or filter you, and you can clear it any time.
        </p>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.saved && <p className="text-sm text-foreground">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save age range'}
      </Button>
    </form>
  )
}

export function HireOutcomeForm() {
  const [state, formAction, pending] = useActionState<OutcomeFormState, FormData>(recordHireOutcome, undefined)

  if (state?.saved) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6">
        <p className="text-lg font-semibold text-foreground">Thank you</p>
        <p className="mt-2 text-sm text-foreground">
          This helps us show what actually works for people at your stage of a search. It is never used to score or rank you.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What kind of work is it?</legend>
        <div className="flex flex-wrap gap-2">
          {OUTCOME_TYPES.map((o, i) => (
            <label key={o.value} className="cursor-pointer">
              <input type="radio" name="outcomeType" value={o.value} defaultChecked={i === 0} className="peer sr-only" />
              <span className="inline-block rounded-md border border-input px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="source">How did it come together?</Label>
          <select id="source" name="source" required defaultValue="" className={selectClass}>
            <option value="" disabled>
              Choose one
            </option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hiredAt">Start date</Label>
          <Input id="hiredAt" name="hiredAt" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priorBasePayUsd">Previous yearly base pay (optional)</Label>
          <Input id="priorBasePayUsd" name="priorBasePayUsd" inputMode="numeric" placeholder="For example 180000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newBasePayUsd">New yearly base pay (optional)</Label>
          <Input id="newBasePayUsd" name="newBasePayUsd" inputMode="numeric" placeholder="For example 165000" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Is this the same level as your last role, or higher?</legend>
        <div className="flex gap-2">
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'skip', label: 'Prefer not to say' },
          ].map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input type="radio" name="levelRetained" value={o.value} defaultChecked={o.value === 'skip'} className="peer sr-only" />
              <span className="inline-block rounded-md border border-input px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save how it came together'}
      </Button>
    </form>
  )
}
