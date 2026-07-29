'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RatingScale } from './RatingScale'
import { BARSRatingScale } from './BARSRatingScale'
import { cn } from '@/lib/utils'

interface DimensionGroup {
  dimension: string
  dimensionLabel: string
  anchors: { scalePoint: number; anchorText: string }[]
}

export type ReferenceFormState = { error?: string } | undefined

// The Prompt 48 mirrored-trait reference instrument — one question set,
// two entry points. `action` is pluggable (rather than hardcoding
// submitReference) specifically so the Prompt 65 employer-submitted flow
// can reuse this exact component/fields against its own server action
// instead of a second, duplicate form with the same questions.
export function ReferenceSubmissionForm({
  token,
  candidateName,
  dimensionGroups,
  action,
  hiddenFields,
  submitLabel = 'Submit reference',
  beforeContent,
}: {
  token?: string
  candidateName: string
  dimensionGroups: DimensionGroup[]
  action: (state: ReferenceFormState, formData: FormData) => Promise<ReferenceFormState>
  hiddenFields?: Record<string, string>
  submitLabel?: string
  // Extra fields rendered inside the same <form>, before the reference
  // questions — the Prompt 65 employer flow uses this for the
  // employer/employee identification fields that have no equivalent in
  // the token-based referee flow (which already knows who's referring).
  beforeContent?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      {token && <input type="hidden" name="token" value={token} />}
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {beforeContent}

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

      <div className="space-y-6 border-t border-border pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">
          A few traits, one example each — these help paint a fuller picture than ratings alone.
        </h2>
        <TraitRow
          name="adaptability"
          label="Adaptability — how they handle change and ambiguity"
          candidateName={candidateName}
        />
        <TraitRow
          name="followThrough"
          label="Follow-Through — reliability, does what they say"
          candidateName={candidateName}
        />
        <TraitRow
          name="presence"
          label="Presence — how they show up with people, communication style"
          candidateName={candidateName}
        />
        <TraitRow
          name="collaboration"
          label="Collaboration — team impact, how they make others better"
          candidateName={candidateName}
        />
        <TraitRow
          name="composure"
          label="Composure — how they operate under pressure"
          candidateName={candidateName}
        />
      </div>

      <div className="space-y-6 border-t border-border pt-6">
        <div className="space-y-2">
          <Label htmlFor="superpowerText">
            What&apos;s their superpower — the thing they&apos;re better at than almost anyone
            you&apos;ve worked with?
          </Label>
          <Textarea id="superpowerText" name="superpowerText" rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="underPressureStory">
            Describe {candidateName} under real pressure — a specific moment, not a generality.
          </Label>
          <Textarea id="underPressureStory" name="underPressureStory" rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="definingStory">One story that shows who they are, not just what they did.</Label>
          <Textarea id="definingStory" name="definingStory" rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wouldWorkWithAgainReason">Why (or why not)?</Label>
          <Textarea id="wouldWorkWithAgainReason" name="wouldWorkWithAgainReason" rows={2} />
        </div>
      </div>

      <fieldset className="space-y-2 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Can we quote you by name?</legend>
        <p className="text-sm text-muted-foreground">
          {candidateName} reviews and approves every quote before it&apos;s used — nothing is
          published automatically.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="quotableWithAttribution" value="yes" required /> Yes, quote me with my name
            and title
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="quotableWithAttribution" value="no" /> Keep this available on request only
          </label>
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : submitLabel}
      </Button>
    </form>
  )
}

// One of the five reference-only trait ratings (Prompt 48) — a 1-5 scale
// plus a required one-example text, same shape for all five.
function TraitRow({ name, label, candidateName }: { name: string; label: string; candidateName: string }) {
  return (
    <div className="space-y-2">
      <RatingScale name={`trait-${name}`} label={label} lowLabel="Rarely" highLabel="Consistently" />
      <div className="space-y-1">
        <Label htmlFor={`trait-example-${name}`} className="text-sm font-normal text-muted-foreground">
          One example of {candidateName} showing this
        </Label>
        <Textarea id={`trait-example-${name}`} name={`traitExample-${name}`} rows={2} />
      </div>
    </div>
  )
}
