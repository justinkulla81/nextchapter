'use client'

import { useActionState, useState } from 'react'
import { approveTargetLineAction, skipTargetLineAction } from '@/app/dashboard/resume/walkthrough/actions'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { InterviewComfortNote } from './InterviewComfortNote'
import { cn } from '@/lib/utils'

// Reuses CandidateProfile.positioningStatementText/Draft/SetAt — the same
// field the Executive Dossier's PositioningStatementApproval.tsx
// draft-then-approve flow already writes (src/app/dashboard/
// recruiter-report/actions.ts approvePositioningStatement). Judgment call:
// that flow is scoped to the broader Dossier career narrative, not
// specifically "a target line tuned for this resume," but a candidate only
// has one professional positioning line worth having — splitting it into a
// Dossier version and a separate resume-walkthrough version would just be
// two competing sources of truth for the same sentence, with no real
// difference in what either is trying to say. Reusing the field means
// approving it here also finishes the Dossier's ask, and vice versa; the
// interaction pattern below intentionally mirrors PositioningStatementApproval's
// visual/interaction shape rather than inventing new UI for the same job.
export function TargetLineStep({
  draftText,
  approvedText,
  nextStep,
}: {
  draftText: string | null
  approvedText: string | null
  nextStep: number
}) {
  const [approveState, approveFormAction, approvePending] = useActionState(approveTargetLineAction, undefined)
  const [skipState, skipFormAction, skipPending] = useActionState(skipTargetLineAction, undefined)
  const [text, setText] = useState(approvedText ?? draftText ?? '')
  const pending = approvePending || skipPending

  return (
    <div className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-foreground">
        This is the one line a recruiter reads first — what you do, at what level, headed where next.
      </p>

      {!draftText && !approvedText && (
        <p className="text-sm text-muted-foreground">
          We don&apos;t have enough to draft this from yet — write your own below, or skip for now and come back
          once your profile has more filled in.
        </p>
      )}

      {draftText && !approvedText && (
        <p className="text-xs text-muted-foreground italic">AI-drafted from your profile — review and edit before approving.</p>
      )}

      <form action={approveFormAction} className="space-y-3">
        <Textarea
          name="positioningStatementText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. VP of Marketing with 12 years scaling demand gen at B2B SaaS companies, now targeting CMO roles at Series C-E startups."
        />
        <InterviewComfortNote />
        <input type="hidden" name="nextStep" value={nextStep} />
        {approveState?.error && <p className="text-sm text-destructive">{approveState.error}</p>}
        <div className="flex gap-3">
          <SubmitButton pendingLabel="Saving…">{approvedText ? 'Update target line' : 'Approve target line'}</SubmitButton>
        </div>
      </form>

      <form action={skipFormAction}>
        <input type="hidden" name="nextStep" value={nextStep} />
        {skipState?.error && <p className="text-sm text-destructive">{skipState.error}</p>}
        <SubmitButton variant="ghost" size="sm" pendingLabel="Loading…">
          Skip for now
        </SubmitButton>
      </form>
    </div>
  )
}
