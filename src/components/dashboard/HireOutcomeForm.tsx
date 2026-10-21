'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
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

// Controls at reading size: text-base labels and hints, taller fields.
const R = {
  label: 'text-base text-ink',
  hint: 'max-w-2xl text-base text-muted-foreground',
  field: 'h-11 text-base',
  select: 'h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  error: 'text-base text-destructive',
  saved: 'text-base font-medium text-ink',
}

export function LastJobEndedForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState<OutcomeFormState, FormData>(saveLastJobEndedAt, undefined)
  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="space-y-1.5">
        <Label htmlFor="lastJobEndedAt" className={R.label}>Last day you worked</Label>
        <Input id="lastJobEndedAt" name="lastJobEndedAt" type="date" defaultValue={current ?? ''} required className={R.field} />
        <p className={R.hint}>
          We use this to compare your progress with people at the same stage of a search, so a long search is never held
          against you. It stays private.
        </p>
      </div>
      {state?.error && <p className={R.error}>{state.error}</p>}
      {state?.saved && <p className={R.saved}>Saved.</p>}
      <Button type="submit" disabled={pending} variant="outline" className="h-10 rounded-full px-5">
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
        <Label htmlFor="ageBand" className={R.label}>Age range (optional)</Label>
        <select id="ageBand" name="ageBand" defaultValue={current ?? ''} className={R.select}>
          <option value="">Prefer not to say</option>
          {AGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className={R.hint}>
          Used only to show guidance that fits your situation and to compare you with people in a similar one. It is never used to
          rank or filter you, and you can clear it any time.
        </p>
      </div>
      {state?.error && <p className={R.error}>{state.error}</p>}
      {state?.saved && <p className={R.saved}>Saved.</p>}
      <Button type="submit" disabled={pending} variant="outline" className="h-10 rounded-full px-5">
        {pending ? 'Saving…' : 'Save age range'}
      </Button>
    </form>
  )
}

export function HireOutcomeForm() {
  const [state, formAction, pending] = useActionState<OutcomeFormState, FormData>(recordHireOutcome, undefined)

  if (state?.saved) {
    return (
      <div className="space-y-1">
        <p className="font-display text-xl font-semibold text-ink">Thank you</p>
        <p className="max-w-2xl text-base text-ink">
          This helps us show what actually works for people at your stage of a search. It is never used to score or rank you.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-6', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <fieldset className="space-y-2">
        <legend className={R.label}>What kind of work is it?</legend>
        <ChoiceButtons name="outcomeType" label="What kind of work is it?" options={OUTCOME_TYPES} defaultValue="PERMANENT" />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="source" className={R.label}>How did it come together?</Label>
          <select id="source" name="source" required defaultValue="" className={R.select}>
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
          <Label htmlFor="hiredAt" className={R.label}>Start date</Label>
          <Input id="hiredAt" name="hiredAt" type="date" required className={R.field} />
        </div>
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className={R.label}>Where is the job? (optional)</legend>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="workCity" className="sr-only">City</Label>
            <Input id="workCity" name="workCity" placeholder="City" maxLength={80} className={cn(R.field, 'w-44')} />
            <Label htmlFor="workState" className="sr-only">State</Label>
            <Input id="workState" name="workState" placeholder="State, like KY" maxLength={2} className={cn(R.field, 'w-36 uppercase')} />
            <label className="flex items-center gap-2 text-base text-ink">
              <input type="checkbox" name="workRemote" />
              Fully remote
            </label>
          </div>
          <p className={R.hint}>If you came through a local program, this helps it show how many people found work close to home. Only counts are shared.</p>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="priorBasePayUsd" className={R.label}>Previous yearly base pay (optional)</Label>
          <Input id="priorBasePayUsd" name="priorBasePayUsd" inputMode="numeric" placeholder="For example 180000" className={R.field} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newBasePayUsd" className={R.label}>New yearly base pay (optional)</Label>
          <Input id="newBasePayUsd" name="newBasePayUsd" inputMode="numeric" placeholder="For example 165000" className={R.field} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className={R.label}>Is this the same level as your last role, or higher?</legend>
        <ChoiceButtons
          name="levelRetained"
          label="Is this the same level as your last role, or higher?"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'skip', label: 'Prefer not to say' },
          ]}
          defaultValue="skip"
        />
      </fieldset>

      {state?.error && <p className={R.error}>{state.error}</p>}

      <Button type="submit" disabled={pending} variant="outline" className="h-10 rounded-full px-5">
        {pending ? 'Saving…' : 'Save how it came together'}
      </Button>
    </form>
  )
}
