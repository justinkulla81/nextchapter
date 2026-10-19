'use client'

import { useActionState, useState } from 'react'
import { saveCareerGoals } from '@/app/dashboard/search-strategy/career-actions'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { CAREER_FOCUS, CAREER_INTENT, type CareerDetails } from '@/lib/journey/career'

// "What do you want from your career?" for people who are staying or going for a
// promotion. Saved to journeyDetails.career; the plan reads it (src/lib/journey/career.ts).
export function CareerGoalsForm({ initial }: { initial: CareerDetails | null }) {
  const [state, action, pending] = useActionState(saveCareerGoals, undefined)
  const [focus, setFocus] = useState<string | null>(initial?.focus ?? null)
  const [intent, setIntent] = useState<string | null>(initial?.intent ?? null)
  return (
    <form action={action} className={pending ? 'cursor-progress space-y-4 [&_*]:cursor-progress' : 'space-y-4'}>
      <div className="space-y-1.5">
        <Label>What matters most right now?</Label>
        <ChoiceButtons name="focus" options={CAREER_FOCUS.map((f) => ({ value: f.key, label: f.label }))} value={focus} onChange={setFocus} columns={3} responsive />
      </div>
      <div className="space-y-1.5">
        <Label>Where do you see the next year?</Label>
        <ChoiceButtons name="intent" options={CAREER_INTENT.map((i) => ({ value: i.key, label: i.label }))} value={intent} onChange={setIntent} columns={3} responsive />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nextLevel">The next role or level you want (optional)</Label>
          <Input id="nextLevel" name="nextLevel" maxLength={120} defaultValue={initial?.nextLevel ?? ''} placeholder="Senior manager" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reviewDate">Your next review (optional)</Label>
          <Input id="reviewDate" name="reviewDate" type="date" defaultValue={initial?.reviewDate ?? ''} />
        </div>
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-brand">Saved. Your weekly plan will use this.</p>}
      <SubmitButton disabled={!focus || !intent} title={!focus || !intent ? 'Choose what matters most and where you see the next year' : undefined}>
        Save what I want from my career
      </SubmitButton>
      {(!focus || !intent) && <p className="text-xs text-muted-foreground">Choose what matters most and where you see the next year to save.</p>}
    </form>
  )
}
