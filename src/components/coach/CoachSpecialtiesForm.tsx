'use client'

import { useActionState } from 'react'
import { updateCoachSpecialties } from '@/app/support/coach/(app)/settings/[token]/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { HIGHEST_LEVEL_OPTIONS, PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { COACHING_STYLES, COACHING_STYLE_COACH_LABEL } from '@/lib/coach/coaching-style'
import type { Coach } from '@prisma/client'

const chip =
  'cursor-pointer rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-ring has-[:checked]:bg-muted'

function CheckGroup({
  name,
  options,
  selected,
}: {
  name: string
  options: { value: string; label: string }[]
  selected: string[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className={chip}>
          <input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export function CoachSpecialtiesForm({ token, coach }: { token: string; coach: Coach }) {
  const [state, formAction] = useActionState(updateCoachSpecialties.bind(null, token), undefined)
  const same = (v: string) => ({ value: v, label: v })

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label>How you coach</Label>
        <p className="text-xs text-muted-foreground">Pick what you really deliver. Members ask for these.</p>
        <CheckGroup
          name="coachingStyles"
          selected={coach.coachingStyles}
          options={COACHING_STYLES.map((s) => ({ value: s, label: COACHING_STYLE_COACH_LABEL[s] }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Functions you coach</Label>
        <CheckGroup name="functions" selected={coach.functions} options={PRIMARY_FUNCTION_OPTIONS.map(same)} />
      </div>

      <div className="space-y-2">
        <Label>Levels you work with</Label>
        <CheckGroup name="seniorityFit" selected={coach.seniorityFit} options={HIGHEST_LEVEL_OPTIONS.map(same)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industries">Industries</Label>
        <Input id="industries" name="industries" defaultValue={coach.industries.join(', ')} placeholder="Healthcare, Fintech, Manufacturing" />
        <p className="text-xs text-muted-foreground">Separate with commas.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Skills you are strongest at</Label>
        <Input id="skills" name="skills" defaultValue={coach.skills.join(', ')} placeholder="Negotiation, executive presence, interviewing" />
        <p className="text-xs text-muted-foreground">Members who want to build one of these see you first.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">Gender</Label>
        <select
          id="gender"
          name="gender"
          defaultValue={coach.gender ?? ''}
          className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="nonbinary">Non-binary</option>
        </select>
        <p className="text-xs text-muted-foreground">Only used when a member asks for a coach of a particular gender.</p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.saved && <p className="text-sm text-muted-foreground">Saved.</p>}
      <SubmitButton pendingLabel="Saving…">Save specialties</SubmitButton>
    </form>
  )
}
