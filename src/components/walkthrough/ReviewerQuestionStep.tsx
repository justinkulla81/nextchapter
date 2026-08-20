'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { EducationEntry, WorkHistoryEntry } from '@prisma/client'
import { resolveReviewerQuestionAction, resolveGapWithInterimWorkAction } from '@/app/dashboard/resume/walkthrough/actions'
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

const GAP_DETECTION_TYPES = new Set(['UNEXPLAINED_RECENT_GAP', 'UNEXPLAINED_CURRENT_GAP'])

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
        {GAP_DETECTION_TYPES.has(detectionType) && existingResolution === 'LEAVE_AS_IS' && (
          <InterimWorkRecommendation />
        )}
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

      {mode === 'question' && GAP_DETECTION_TYPES.has(detectionType) && (
        <GapChoices
          questionId={questionId}
          stepLabel={stepLabel}
          nextStep={nextStep}
          onWrong={() => setMode('correcting')}
          notApplicableAction={notApplicableAction}
          notApplicablePending={notApplicablePending}
          leaveAsIsAction={leaveAsIsAction}
          leaveAsIsPending={leaveAsIsPending}
          error={notApplicableState?.error ?? leaveAsIsState?.error}
        />
      )}

      {mode === 'question' && !GAP_DETECTION_TYPES.has(detectionType) && (
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

// Gap-specific branch (UNEXPLAINED_RECENT_GAP/UNEXPLAINED_CURRENT_GAP only)
// — same "wrong"/"not applicable" escape hatches as the generic question
// UI, but the accurate-as-detected path forks into two real answers
// instead of one generic "leave as is": a real gap (resolves LEAVE_AS_IS,
// same as before, then recommends interim work) vs. there was interim/
// other work that just isn't on the resume yet (adds it for real via
// resolveGapWithInterimWorkAction, which also resolves the question).
function GapChoices({
  questionId,
  stepLabel,
  nextStep,
  onWrong,
  notApplicableAction,
  notApplicablePending,
  leaveAsIsAction,
  leaveAsIsPending,
  error,
}: {
  questionId: string
  stepLabel: string
  nextStep: number
  onWrong: () => void
  notApplicableAction: (formData: FormData) => void
  notApplicablePending: boolean
  leaveAsIsAction: (formData: FormData) => void
  leaveAsIsPending: boolean
  error?: string
}) {
  const [showInterimForm, setShowInterimForm] = useState(false)
  const pending = notApplicablePending || leaveAsIsPending

  if (showInterimForm) {
    return <GapInterimWorkForm questionId={questionId} stepLabel={stepLabel} nextStep={nextStep} onCancel={() => setShowInterimForm(false)} />
  }

  return (
    <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onWrong}>
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

      <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setShowInterimForm(true)}
          className="rounded-lg border border-border p-3 text-left text-sm hover:border-primary hover:bg-primary/5"
        >
          <p className="font-medium text-foreground">There was interim or other work</p>
          <p className="text-xs text-muted-foreground">
            Fractional, consulting, a project, caregiving you want on record — add it, and this closes the gap.
          </p>
        </button>
        <form action={leaveAsIsAction} className="rounded-lg border border-border p-3">
          <p className="font-medium text-foreground">This is a real gap</p>
          <Label htmlFor="rq-gap-note" className="mt-1 block font-normal text-xs text-muted-foreground">
            Optional note for context
          </Label>
          <Textarea id="rq-gap-note" name="explanation" rows={2} placeholder="e.g. layoff, caregiving, job search" className="mt-1" />
          <input type="hidden" name="id" value={questionId} />
          <input type="hidden" name="resolutionType" value="LEAVE_AS_IS" />
          <input type="hidden" name="stepLabel" value={stepLabel} />
          <input type="hidden" name="nextStep" value={nextStep} />
          <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…" className="mt-2">
            Confirm — it&apos;s a real gap
          </SubmitButton>
        </form>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// Inline "add the interim work" form for GapChoices' second path — same
// fields as the plain Work History add-entry form, scoped to this one
// action (resolveGapWithInterimWorkAction) so submitting both adds the
// entry and resolves the reviewer question in one step.
function GapInterimWorkForm({
  questionId,
  stepLabel,
  nextStep,
  onCancel,
}: {
  questionId: string
  stepLabel: string
  nextStep: number
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(resolveGapWithInterimWorkAction, undefined)
  const [isCurrent, setIsCurrent] = useState(false)

  return (
    <form action={formAction} className={cn('space-y-3 rounded-lg border border-border p-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-foreground">What was it?</p>
      <input type="hidden" name="id" value={questionId} />
      <input type="hidden" name="stepLabel" value={stepLabel} />
      <input type="hidden" name="nextStep" value={nextStep} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="gap-companyName">Company / client</Label>
          <Input id="gap-companyName" name="companyName" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gap-roleTitle">Role</Label>
          <Input id="gap-roleTitle" name="roleTitle" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gap-startDate">Start date</Label>
          <Input id="gap-startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gap-endDate">End date</Label>
          <Input id="gap-endDate" name="endDate" type="date" disabled={isCurrent} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox name="isCurrent" checked={isCurrent} onCheckedChange={(checked) => setIsCurrent(checked === true)} />
        This is ongoing
      </label>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-3">
        <SubmitButton pendingLabel="Saving…">Add it and close this gap</SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  )
}

function InterimWorkRecommendation() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm text-foreground">
        Worth considering: interim, fractional, or project work between now and your next role keeps your
        resume current and gives you something real to talk about.
      </p>
      <Link href="/dashboard/interim-work" className="text-sm font-medium text-primary underline underline-offset-4">
        Find interim work →
      </Link>
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
