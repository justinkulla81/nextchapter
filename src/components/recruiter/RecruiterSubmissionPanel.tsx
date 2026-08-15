'use client'

import { useActionState } from 'react'
import type { RecruiterCandidateSubmission, RecruiterPlacement, RecruiterSubmissionStage } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { STAGE_LABEL, nextStage } from '@/lib/recruiter/submission-stages'
import {
  createCandidateSubmission,
  advanceCandidateSubmissionStage,
  passCandidateSubmission,
  recordCandidatePlacement,
  type SubmissionActionState,
} from '@/app/recruiters/(app)/search/[candidateId]/submission-actions'

// daysSinceUpdate is computed server-side (see the recruiter candidate-
// brief page) and passed down as a plain number — Date.now() must never be
// called during a component's render (react-hooks/purity), so this client
// component only ever receives an already-resolved value, never computes
// one itself.
type SubmissionWithPlacement = RecruiterCandidateSubmission & { placement: RecruiterPlacement | null; daysSinceUpdate: number }

// §A6.2 — "feedback loop (reviewed / screened / submitted / interviewed /
// placed / passed with reason) · placement and fee tracking." One row per
// RecruiterCandidateSubmission (this recruiter's own log of "I put this
// candidate forward for a role" — see submissions.ts), each with its own
// advance/pass/record-placement controls.
export function RecruiterSubmissionPanel({
  candidateId,
  submissions,
}: {
  candidateId: string
  submissions: SubmissionWithPlacement[]
}) {
  return (
    <div className="space-y-4">
      <NewSubmissionForm candidateId={candidateId} />
      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No submissions logged for this candidate yet — log one above once you put them forward for a role.
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionRow key={s.id} submission={s} candidateId={candidateId} />
          ))}
        </div>
      )}
    </div>
  )
}

function NewSubmissionForm({ candidateId }: { candidateId: string }) {
  const action = createCandidateSubmission.bind(null, candidateId)
  const [state, formAction, pending] = useActionState<SubmissionActionState, FormData>(action, undefined)

  return (
    <form
      action={formAction}
      className={pending ? 'cursor-progress space-y-2 rounded-lg border border-border p-4 [&_*]:cursor-progress' : 'space-y-2 rounded-lg border border-border p-4'}
    >
      <p className="text-sm font-medium text-foreground">Log a submission</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="roleTitle">Role title</Label>
          <Input id="roleTitle" name="roleTitle" required placeholder="e.g. VP Engineering" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required placeholder="e.g. Acme Corp" />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Logging…' : 'Log submission'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  )
}

function SubmissionRow({ submission, candidateId }: { submission: SubmissionWithPlacement; candidateId: string }) {
  const upcoming = submission.stage === 'PASSED' ? null : nextStage(submission.stage)
  const isTerminal = submission.stage === 'PLACED' || submission.stage === 'PASSED'
  const { daysSinceUpdate } = submission

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {submission.roleTitle} <span className="text-muted-foreground">at {submission.companyName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {daysSinceUpdate === 0 ? 'Updated today' : `Updated ${daysSinceUpdate} day${daysSinceUpdate === 1 ? '' : 's'} ago`}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {STAGE_LABEL[submission.stage]}
        </span>
      </div>

      {submission.stage === 'PASSED' && submission.passedReason && (
        <p className="text-sm text-muted-foreground">Reason: {submission.passedReason}</p>
      )}

      {submission.placement && (
        <div className="rounded-md bg-muted/40 p-3 text-sm text-foreground">
          <p className="font-medium">Placed</p>
          {submission.placement.feeType && (
            <p className="mt-1 text-muted-foreground">
              Fee: {submission.placement.feeType === 'PERCENTAGE_OF_COMP' && submission.placement.feePercentage != null
                ? `${submission.placement.feePercentage}% of comp`
                : submission.placement.feeType === 'FLAT_FEE' && submission.placement.feeFlatAmountUsd != null
                  ? `$${submission.placement.feeFlatAmountUsd.toLocaleString()} flat`
                  : 'Retainer'}
            </p>
          )}
        </div>
      )}

      {!isTerminal && (
        <div className="flex flex-wrap items-center gap-2">
          {upcoming && <AdvanceStageButton submissionId={submission.id} candidateId={candidateId} toStage={upcoming} />}
          {submission.stage === 'INTERVIEWED' && (
            <RecordPlacementForm submissionId={submission.id} candidateId={candidateId} />
          )}
          <PassForm submissionId={submission.id} candidateId={candidateId} />
        </div>
      )}
    </div>
  )
}

function AdvanceStageButton({
  submissionId,
  candidateId,
  toStage,
}: {
  submissionId: string
  candidateId: string
  toStage: Exclude<RecruiterSubmissionStage, 'PASSED'>
}) {
  return (
    <form action={advanceCandidateSubmissionStage.bind(null, submissionId, candidateId, toStage)}>
      <SubmitButton size="sm" variant="outline">
        Mark {STAGE_LABEL[toStage]}
      </SubmitButton>
    </form>
  )
}

function PassForm({ submissionId, candidateId }: { submissionId: string; candidateId: string }) {
  const action = passCandidateSubmission.bind(null, submissionId, candidateId)
  const [state, formAction, pending] = useActionState<SubmissionActionState, FormData>(action, undefined)

  return (
    <form action={formAction} className={pending ? 'cursor-progress flex flex-wrap items-center gap-2 [&_*]:cursor-progress' : 'flex flex-wrap items-center gap-2'}>
      <Input name="reason" placeholder="Reason for passing" className="h-9 w-56" required />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? 'Saving…' : 'Pass'}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

function RecordPlacementForm({ submissionId, candidateId }: { submissionId: string; candidateId: string }) {
  const action = recordCandidatePlacement.bind(null, submissionId, candidateId)
  const [state, formAction, pending] = useActionState<SubmissionActionState, FormData>(action, undefined)

  return (
    <details className="w-full">
      <summary className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">
        Record placement
      </summary>
      <form
        action={formAction}
        className={pending ? 'cursor-progress mt-3 space-y-2 rounded-md border border-border p-3 [&_*]:cursor-progress' : 'mt-3 space-y-2 rounded-md border border-border p-3'}
      >
        <p className="text-xs text-muted-foreground">
          Fee terms default from your firm&apos;s configured arrangement — override any field below if this
          placement is different.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`startDate-${submissionId}`}>Start date</Label>
            <Input id={`startDate-${submissionId}`} name="startDate" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`feePercentage-${submissionId}`}>Fee % (if applicable)</Label>
            <Input id={`feePercentage-${submissionId}`} name="feePercentage" type="number" min={0} max={100} step="0.5" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`feeFlatAmountUsd-${submissionId}`}>Flat fee, USD (if applicable)</Label>
            <Input id={`feeFlatAmountUsd-${submissionId}`} name="feeFlatAmountUsd" type="number" min={0} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`feeType-${submissionId}`}>Fee type</Label>
          <select
            id={`feeType-${submissionId}`}
            name="feeType"
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Use firm default</option>
            <option value="PERCENTAGE_OF_COMP">% of first-year comp</option>
            <option value="FLAT_FEE">Flat fee</option>
            <option value="RETAINER">Retainer</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`feeNotes-${submissionId}`}>Notes</Label>
          <Textarea id={`feeNotes-${submissionId}`} name="feeNotes" rows={2} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving…' : 'Record placement'}
          </Button>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        </div>
      </form>
    </details>
  )
}
