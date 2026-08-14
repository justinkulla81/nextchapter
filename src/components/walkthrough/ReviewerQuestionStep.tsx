'use client'

import { useActionState, useState } from 'react'
import type { EducationEntry, WorkHistoryEntry } from '@prisma/client'
import { resolveReviewerQuestionAction } from '@/app/dashboard/resume/walkthrough/actions'
import type { ReviewerCorrectionTarget } from '@/lib/walkthrough/reviewer-correction'
import type { ReviewerResolutionType } from '@/lib/walkthrough/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

type Mode = 'question' | 'correcting'

const RESOLUTION_SUMMARY: Record<ReviewerResolutionType, string> = {
  CORRECTED: 'Corrected — the underlying data was updated.',
  NOT_APPLICABLE: 'Marked not applicable.',
  LEAVE_AS_IS: 'Left as is — still open.',
}

// §13.1's "three kinds of no": that's wrong (correct the source data, the
// detection disappears for good) · not applicable (permanent dismissal) ·
// leave as is (stays visible as "still open," not re-asked this session).
// Shared between the two-reviewer-questions step and the thin-entry step —
// same mechanism, THIN_RECENT_ENTRY is just one more detectionType.
export function ReviewerQuestionStep({
  questionId,
  detectionType,
  challengeCopy,
  correctionTarget,
  stepLabel,
  nextStep,
  existingResolution,
}: {
  questionId: string
  detectionType: string
  challengeCopy: string
  correctionTarget: ReviewerCorrectionTarget
  stepLabel: string
  nextStep: number
  existingResolution: ReviewerResolutionType | null
}) {
  const [mode, setMode] = useState<Mode>('question')
  const [notApplicableState, notApplicableAction, notApplicablePending] = useActionState(
    resolveReviewerQuestionAction,
    undefined
  )
  const [leaveAsIsState, leaveAsIsAction, leaveAsIsPending] = useActionState(resolveReviewerQuestionAction, undefined)
  const [continueState, continueAction, continuePending] = useActionState(resolveReviewerQuestionAction, undefined)

  if (existingResolution) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">{challengeCopy}</p>
        <p className="text-sm font-medium text-success">{RESOLUTION_SUMMARY[existingResolution]}</p>
        <form action={continueAction} className={continuePending ? 'cursor-progress [&_*]:cursor-progress' : ''}>
          <input type="hidden" name="id" value={questionId} />
          <input type="hidden" name="resolutionType" value={existingResolution} />
          <input type="hidden" name="stepLabel" value={stepLabel} />
          <input type="hidden" name="nextStep" value={nextStep} />
          {continueState?.error && <p className="text-sm text-destructive">{continueState.error}</p>}
          <SubmitButton pendingLabel="Loading…">Continue</SubmitButton>
        </form>
      </div>
    )
  }

  const pending = notApplicablePending || leaveAsIsPending

  return (
    <div className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-foreground">{challengeCopy}</p>

      {mode === 'question' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setMode('correcting')}>
              No, that&apos;s wrong — let me fix it
            </Button>
            <form action={notApplicableAction}>
              <input type="hidden" name="id" value={questionId} />
              <input type="hidden" name="resolutionType" value="NOT_APPLICABLE" />
              <input type="hidden" name="stepLabel" value={stepLabel} />
              <input type="hidden" name="nextStep" value={nextStep} />
              <SubmitButton variant="outline" pendingLabel="Saving…">
                Not applicable
              </SubmitButton>
            </form>
          </div>

          <form action={leaveAsIsAction} className="space-y-2">
            <Label htmlFor="rq-note" className="font-normal text-muted-foreground">
              It&apos;s accurate — add an optional note for context, or just leave it for now.
            </Label>
            <Textarea id="rq-note" name="explanation" rows={2} placeholder="Optional — e.g. why this happened" />
            <input type="hidden" name="id" value={questionId} />
            <input type="hidden" name="resolutionType" value="LEAVE_AS_IS" />
            <input type="hidden" name="stepLabel" value={stepLabel} />
            <input type="hidden" name="nextStep" value={nextStep} />
            {(notApplicableState?.error || leaveAsIsState?.error) && (
              <p className="text-sm text-destructive">{notApplicableState?.error ?? leaveAsIsState?.error}</p>
            )}
            <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…">
              Leave as is
            </SubmitButton>
          </form>
        </div>
      )}

      {mode === 'correcting' && (
        <CorrectionForm
          questionId={questionId}
          detectionType={detectionType}
          correctionTarget={correctionTarget}
          stepLabel={stepLabel}
          nextStep={nextStep}
          onCancel={() => setMode('question')}
        />
      )}
    </div>
  )
}

function CorrectionForm({
  questionId,
  correctionTarget,
  stepLabel,
  nextStep,
  onCancel,
}: {
  questionId: string
  detectionType: string
  correctionTarget: ReviewerCorrectionTarget
  stepLabel: string
  nextStep: number
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(resolveReviewerQuestionAction, undefined)

  if (correctionTarget.kind === 'unmatched') {
    return (
      <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t automatically find the matching entry to edit. Update it directly in your work history
          below, then confirm here once it&apos;s fixed.
        </p>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={questionId} />
          <input type="hidden" name="resolutionType" value="CORRECTED" />
          <input type="hidden" name="stepLabel" value={stepLabel} />
          <input type="hidden" name="nextStep" value={nextStep} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex gap-3">
            <SubmitButton pendingLabel="Saving…">I&apos;ve fixed it</SubmitButton>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Back
            </Button>
          </div>
        </form>
      </div>
    )
  }

  if (correctionTarget.kind === 'education') {
    return (
      <EducationCorrectionForm
        questionId={questionId}
        entries={correctionTarget.entries}
        stepLabel={stepLabel}
        nextStep={nextStep}
        onCancel={onCancel}
      />
    )
  }

  return (
    <WorkHistoryCorrectionForm
      questionId={questionId}
      entries={correctionTarget.entries}
      stepLabel={stepLabel}
      nextStep={nextStep}
      onCancel={onCancel}
    />
  )
}

function WorkHistoryCorrectionForm({
  questionId,
  entries,
  stepLabel,
  nextStep,
  onCancel,
}: {
  questionId: string
  entries: WorkHistoryEntry[]
  stepLabel: string
  nextStep: number
  onCancel: () => void
}) {
  const [selectedId, setSelectedId] = useState(entries[0].id)
  const selected = entries.find((e) => e.id === selectedId) ?? entries[0]
  const [isCurrent, setIsCurrent] = useState(selected.isCurrent)
  const [state, formAction, pending] = useActionState(resolveReviewerQuestionAction, undefined)

  function toDateInputValue(date: Date | null): string {
    if (!date) return ''
    return date.toISOString().slice(0, 10)
  }

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      {entries.length > 1 && (
        <div className="flex gap-2">
          {entries.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              variant={entry.id === selectedId ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedId(entry.id)
                setIsCurrent(entry.isCurrent)
              }}
            >
              {entry.roleTitle}
            </Button>
          ))}
        </div>
      )}

      <input type="hidden" name="id" value={questionId} />
      <input type="hidden" name="resolutionType" value="CORRECTED" />
      <input type="hidden" name="stepLabel" value={stepLabel} />
      <input type="hidden" name="nextStep" value={nextStep} />
      <input type="hidden" name="workHistoryEntryId" value={selected.id} />

      <div className="space-y-2">
        <Label htmlFor="wh-c-role">Role title</Label>
        <Input id="wh-c-role" name="roleTitle" key={`role-${selected.id}`} defaultValue={selected.roleTitle} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wh-c-start">Start date</Label>
          <Input
            id="wh-c-start"
            name="startDate"
            type="date"
            key={`start-${selected.id}`}
            defaultValue={toDateInputValue(selected.startDate)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wh-c-end">End date</Label>
          <Input
            id="wh-c-end"
            name="endDate"
            type="date"
            key={`end-${selected.id}`}
            defaultValue={toDateInputValue(selected.endDate)}
            disabled={isCurrent}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="wh-c-current"
          name="isCurrent"
          checked={isCurrent}
          onCheckedChange={(checked) => setIsCurrent(checked === true)}
        />
        <Label htmlFor="wh-c-current" className="font-normal">
          This is my current role
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wh-c-team">Team size (optional)</Label>
        <Input
          id="wh-c-team"
          name="teamSize"
          type="number"
          min="0"
          key={`team-${selected.id}`}
          defaultValue={selected.teamSize ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wh-c-achievement">Key achievement (optional)</Label>
        <Textarea
          id="wh-c-achievement"
          name="keyAchievement"
          key={`achievement-${selected.id}`}
          defaultValue={selected.keyAchievement ?? ''}
          rows={2}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-3">
        <SubmitButton pendingLabel="Saving…">Save correction</SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  )
}

function EducationCorrectionForm({
  questionId,
  entries,
  stepLabel,
  nextStep,
  onCancel,
}: {
  questionId: string
  entries: EducationEntry[]
  stepLabel: string
  nextStep: number
  onCancel: () => void
}) {
  const entry = entries[0]
  const [state, formAction, pending] = useActionState(resolveReviewerQuestionAction, undefined)

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <input type="hidden" name="id" value={questionId} />
      <input type="hidden" name="resolutionType" value="CORRECTED" />
      <input type="hidden" name="stepLabel" value={stepLabel} />
      <input type="hidden" name="nextStep" value={nextStep} />
      <input type="hidden" name="educationEntryId" value={entry.id} />

      <div className="space-y-2">
        <Label htmlFor="ed-c-school">Granting institution</Label>
        <Input id="ed-c-school" name="schoolName" defaultValue={entry.schoolName} required />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-3">
        <SubmitButton pendingLabel="Saving…">Save correction</SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  )
}
