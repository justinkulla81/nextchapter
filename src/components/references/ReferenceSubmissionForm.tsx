'use client'

import { useActionState } from 'react'
import { submitReference } from '@/app/ref/[token]/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RatingScale } from './RatingScale'
import { BARSRatingScale } from './BARSRatingScale'

interface DimensionGroup {
  dimension: string
  dimensionLabel: string
  anchors: { scalePoint: number; anchorText: string }[]
}

export function ReferenceSubmissionForm({
  token,
  candidateName,
  dimensionGroups,
}: {
  token: string
  candidateName: string
  dimensionGroups: DimensionGroup[]
}) {
  const [state, formAction, pending] = useActionState(submitReference, undefined)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="token" value={token} />

      <RatingScale
        name="overallRating"
        label={`Overall, how would you rate working with ${candidateName}?`}
        lowLabel="Poor"
        highLabel="Excellent"
      />

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            For each area below, pick the description that best matches how {candidateName}{' '}
            actually worked.
          </h2>
        </div>
        {dimensionGroups.map((group) => (
          <BARSRatingScale
            key={group.dimension}
            dimension={group.dimension}
            dimensionLabel={group.dimensionLabel}
            anchors={group.anchors}
          />
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm">Would you hire {candidateName} again?</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="wouldHireAgain" value="yes" required /> Yes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="wouldHireAgain" value="no" /> No
          </label>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="strengthSummary">What are they especially good at?</Label>
        <Textarea id="strengthSummary" name="strengthSummary" rows={3} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="growthAreaSummary">Where could they grow? (optional)</Label>
        <Textarea id="growthAreaSummary" name="growthAreaSummary" rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contextNotes">Anything else worth knowing? (optional)</Label>
        <Textarea id="contextNotes" name="contextNotes" rows={2} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit reference'}
      </Button>
    </form>
  )
}
