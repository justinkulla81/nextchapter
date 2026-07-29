'use client'

import { useActionState, useState } from 'react'
import { submitBenefitsPressures } from '@/app/dashboard/benefits/actions'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { BENEFITS_PRESSURE_OPTIONS } from '@/lib/benefits/pressure-options'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

export function BenefitsPressureForm() {
  const [state, formAction] = useActionState(submitBenefitsPressures, undefined)
  const [pressures, setPressures] = useState<string[]>([])

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label>What&apos;s putting the most financial pressure on you right now? (select all that apply)</Label>
        <p className="text-sm text-muted-foreground">
          We&apos;ll use this to point you at the parts of this page that matter most to you.
        </p>
        <MultiChoiceButtons
          name="pressures"
          options={BENEFITS_PRESSURE_OPTIONS}
          value={pressures}
          onChange={setPressures}
          columns={2}
        />
      </div>
      {pressures.includes('OTHER') && (
        <div className="space-y-2">
          <Label htmlFor="otherText">Tell us more</Label>
          <Textarea id="otherText" name="otherText" rows={2} />
        </div>
      )}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Building your plan…">Continue</SubmitButton>
    </form>
  )
}
