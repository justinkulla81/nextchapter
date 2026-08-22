'use client'

import { useActionState, useState } from 'react'
import { submitEqOverIqApplication } from '@/app/eqoveriq/contributors/onboarding/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'

const INTEREST_AREA_OPTIONS = [
  { value: 'MODEL_EVALUATION', label: 'Model evaluation' },
  { value: 'RED_TEAMING', label: 'Red teaming' },
  { value: 'DATA_LABELING', label: 'Data labeling' },
  { value: 'PROMPT_ENGINEERING', label: 'Prompt engineering' },
  { value: 'RLHF', label: 'RLHF' },
  { value: 'FINE_TUNING', label: 'Fine-tuning' },
  { value: 'GENERALIST', label: 'Generalist — open to anything' },
] as const

export function ContributorApplicationForm() {
  const [state, formAction] = useActionState(submitEqOverIqApplication, undefined)
  const [interestAreas, setInterestAreas] = useState<string[]>([])

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="background">Your background</Label>
        <Textarea
          id="background"
          name="background"
          required
          rows={4}
          placeholder="Your professional background — roles, industries, what you're known for."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="experienceSummary">AI / fractional-work experience</Label>
        <Textarea
          id="experienceSummary"
          name="experienceSummary"
          required
          rows={4}
          placeholder="Specific experience relevant to fractional AI work — projects, tools, outcomes."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portfolioLinks">Portfolio links (one per line)</Label>
        <Textarea id="portfolioLinks" name="portfolioLinks" rows={3} placeholder={'linkedin.com/in/you\ngithub.com/you\nyourportfolio.com'} />
      </div>
      <div className="space-y-2">
        <Label>What kind of fractional AI work interests you?</Label>
        <MultiChoiceButtons
          name="interestAreas"
          options={INTEREST_AREA_OPTIONS}
          value={interestAreas}
          onChange={setInterestAreas}
          columns={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whyFractionalAiWork">Why fractional AI work?</Label>
        <Textarea
          id="whyFractionalAiWork"
          name="whyFractionalAiWork"
          required
          rows={3}
          placeholder="What draws you to this kind of work right now?"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Submit application</SubmitButton>
    </form>
  )
}
