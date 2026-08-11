'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RatingScale } from './RatingScale'
import { BARSRatingScale } from './BARSRatingScale'
import { ReferencePerformanceScale } from './ReferencePerformanceScale'
import { cn } from '@/lib/utils'

interface DimensionGroup {
  dimension: string
  dimensionLabel: string
  anchors: { scalePoint: number; anchorText: string }[]
}

const PERFORMANCE_ITEMS: { dimension: string; items: { key: string; label: string }[] }[] = [
  {
    dimension: 'Execution',
    items: [
      { key: 'a1', label: 'Delivered what they committed to, on the timeline they set' },
      { key: 'a2', label: 'Quality of their work product' },
      { key: 'a3', label: 'Ability to run things without supervision' },
    ],
  },
  {
    dimension: 'Judgment',
    items: [
      { key: 'a4', label: "Decision quality when the answer wasn't obvious" },
      { key: 'a5', label: 'Knowing when to escalate versus decide' },
      { key: 'a6', label: 'Reading a situation correctly' },
    ],
  },
  {
    dimension: 'Composure',
    items: [
      { key: 'a7', label: 'Steadiness when things went wrong' },
      { key: 'a8', label: 'Response to hard feedback' },
      { key: 'a9', label: 'Their effect on the people around them under pressure' },
    ],
  },
  {
    dimension: 'Influence',
    items: [
      { key: 'a10', label: "Getting outcomes through people who didn't report to them" },
      { key: 'a11', label: 'Credibility with people more senior' },
      { key: 'a12', label: 'Willingness to say the unwelcome thing' },
    ],
  },
]

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
  isManager = false,
  writtenQuestions,
  verification,
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
  // Part B's b1/b3 are manager-only in copy (worded differently for
  // non-managers, and b3 doesn't render at all for non-managers).
  isManager?: boolean
  // Part C — the two written questions assigned to this reference at
  // invite time (see written-question-pool.ts). Omitted entirely on
  // older/legacy links that predate this feature.
  writtenQuestions?: { key: string; text: string }[]
  // Part D — pre-filled from the candidate's own claim, for the reference
  // to confirm or correct.
  verification?: { claimedTitle: string | null; claimedYearsTogether: number | null }
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

      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Most good people are a <strong className="text-foreground">2</strong>. A 2 means they did
          the job well — it&apos;s not a criticism. Please save <strong className="text-foreground">4</strong>{' '}
          for people you&apos;d describe as among the best you&apos;ve ever worked with. If everyone
          gets a 4, nobody can tell your strong people apart.
        </p>
      </div>

      <div className="space-y-5">
        <h2 className="text-sm font-medium text-foreground">Performance</h2>
        {PERFORMANCE_ITEMS.map((group) => (
          <div key={group.dimension} className="space-y-3">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.dimension}</h3>
            {group.items.map((item) => (
              <ReferencePerformanceScale key={item.key} itemKey={item.key} label={item.label} />
            ))}
          </div>
        ))}
      </div>

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

      <div className="space-y-6 border-t border-border pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Comparative standing</h2>

        <RadioQuestion
          name="compRelativeRank"
          label={
            isManager
              ? `Of everyone who's held a comparable role under you, where does ${candidateName} rank?`
              : `Of everyone you've worked alongside at this level, where does ${candidateName} rank?`
          }
          options={[
            { value: 'BOTTOM_HALF', label: 'Bottom half' },
            { value: 'TOP_HALF', label: 'Top half' },
            { value: 'TOP_25', label: 'Top 25%' },
            { value: 'TOP_10', label: 'Top 10%' },
            { value: 'TOP_1', label: 'Top 1%' },
          ]}
        />

        <RadioQuestion
          name="compWouldHireAgain"
          label={`Would you hire ${candidateName} again?`}
          options={[
            { value: 'NO', label: 'No' },
            { value: 'PROBABLY_NOT', label: 'Probably not' },
            { value: 'PROBABLY', label: 'Probably' },
            { value: 'DEFINITELY', label: 'Definitely' },
          ]}
        />

        {isManager && (
          <RadioQuestion
            name="compDepartureContext"
            label={`When ${candidateName} left, what happened?`}
            options={[
              { value: 'INITIATED_BY_ME', label: 'I initiated it' },
              { value: 'RELIEVED', label: 'I was relieved' },
              { value: 'UNDERSTOOD_SUPPORTED', label: 'I understood and supported it' },
              { value: 'ASKED_TO_STAY', label: 'I asked them to stay' },
              { value: 'FOUGHT_TO_KEEP', label: 'I fought to keep them' },
            ]}
          />
        )}

        <RadioQuestion
          name="compWouldTakeAgain"
          label={`If you were starting something tomorrow and could take five people, would ${candidateName} be one?`}
          options={[
            { value: 'NO', label: 'No' },
            { value: 'MAYBE', label: 'Maybe, depending on the need' },
            { value: 'YES', label: 'Yes' },
            { value: 'YES_FIRST_CALL', label: 'Yes, first call' },
          ]}
        />

        <RadioQuestion
          name="compTrustedScope"
          label={`What's the biggest job you'd trust ${candidateName} with today?`}
          options={[
            { value: 'SAME', label: 'Same scope they had' },
            { value: 'SOMEWHAT_MORE', label: 'Somewhat more' },
            { value: 'MEANINGFULLY_MORE', label: 'Meaningfully more' },
            { value: 'STEP_CHANGE', label: "A step change beyond anything they've done" },
          ]}
        />
      </div>

      {writtenQuestions && writtenQuestions.length > 0 && (
        <div className="space-y-4 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">A couple more, in your own words</h2>
          {writtenQuestions.map((q, i) => (
            <div key={q.key} className="space-y-2">
              <Label htmlFor={`writtenResponse${i + 1}`}>{q.text}</Label>
              <Textarea id={`writtenResponse${i + 1}`} name={`writtenResponse${i + 1}`} rows={3} />
            </div>
          ))}
        </div>
      )}

      {verification && (verification.claimedTitle || verification.claimedYearsTogether != null) && (
        <div className="space-y-4 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-muted-foreground">One last check</h2>
          {verification.claimedTitle && (
            <VerifyRow
              label={`${candidateName} listed their title as "${verification.claimedTitle}." Correct?`}
              correctName="verifiedTitleCorrect"
              correctionName="correctedTitle"
              correctionLabel="What should it say instead?"
            />
          )}
          {verification.claimedYearsTogether != null && (
            <VerifyRow
              label={`They said you worked together for about ${verification.claimedYearsTogether} year${verification.claimedYearsTogether === 1 ? '' : 's'}. Does that match?`}
              correctName="verifiedDatesCorrect"
              correctionName="correctedDates"
              correctionLabel="What's the actual timeframe?"
            />
          )}
          <VerifyRow
            label="Was the reporting relationship they described accurate?"
            correctName="verifiedReportingCorrect"
            correctionName="correctedReporting"
            correctionLabel="What was the actual reporting relationship?"
          />
          <VerifyRow
            label="Does the scope they described (team size, budget, etc.) match what you remember?"
            correctName="verifiedScopeCorrect"
            correctionName="correctedScope"
            correctionLabel="What's different?"
          />
          <RatingScale
            name="verificationConfidence"
            label="How confident are you in these details, overall?"
            lowLabel="Not very"
            highLabel="Very"
          />
        </div>
      )}

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

// Part B comparative-standing question — a plain radio group, deliberately
// NOT styled with the anchored-scale equal-weight treatment (that rule is
// specific to Part A's performance ratings) since these are qualitatively
// distinct multi-choice options, not points on one intensity scale.
function RadioQuestion({
  name,
  label,
  options,
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-foreground">{label}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name={name} value={opt.value} required />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Part D verification row — yes/no plus a conditionally-shown correction
// field. Uses a checkbox-toggled reveal (no JS) so this component can stay
// a plain server-rendered form field like everything else here.
function VerifyRow({
  label,
  correctName,
  correctionName,
  correctionLabel,
}: {
  label: string
  correctName: string
  correctionName: string
  correctionLabel: string
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <fieldset className="space-y-1.5">
        <legend className="text-sm text-foreground">{label}</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={correctName} value="yes" /> Correct
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={correctName} value="no" /> Not quite
          </label>
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor={correctionName} className="text-xs font-normal text-muted-foreground">
          {correctionLabel} (leave blank if correct)
        </Label>
        <Textarea id={correctionName} name={correctionName} rows={1} />
      </div>
    </div>
  )
}
