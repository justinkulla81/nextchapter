'use client'

import { useActionState } from 'react'
import { resolveMechanicalFindingAction } from '@/app/dashboard/resume/walkthrough/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import type { MechanicalBatchFinding } from '@/lib/walkthrough/mechanical-findings'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const SEVERITY_LABEL: Record<string, string> = { HIGH: 'High impact', MEDIUM: 'Medium impact', LOW: 'Worth a look' }

export function MechanicalFindingStep({
  finding,
  handledAction,
  nextStep,
}: {
  finding: MechanicalBatchFinding
  handledAction: 'fixed' | 'skipped' | null
  nextStep: number
}) {
  const [fixedState, fixedFormAction, fixedPending] = useActionState(resolveMechanicalFindingAction, undefined)
  const [skippedState, skippedFormAction, skippedPending] = useActionState(resolveMechanicalFindingAction, undefined)

  if (handledAction) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">{finding.finding.candidateFacingCopy}</p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          {handledAction === 'fixed' ? (
            <>
              <Check className="size-4" aria-hidden /> Marked as fixed
            </>
          ) : (
            'Skipped for now'
          )}
        </p>
        <ContinueForm nextStep={nextStep} findingKey={finding.key} handledAction={handledAction} />
      </div>
    )
  }

  const pending = fixedPending || skippedPending

  return (
    <div className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {SEVERITY_LABEL[finding.finding.severity] ?? finding.finding.severity}
        {finding.finding.estimatedPointGain > 0 ? ` · worth about +${finding.finding.estimatedPointGain} points` : ''}
      </p>
      <p className="text-sm text-foreground">{finding.finding.candidateFacingCopy}</p>
      <p className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">Fix: </span>
        {finding.finding.fix}
      </p>

      {(fixedState?.error || skippedState?.error) && (
        <p className="text-sm text-destructive">{fixedState?.error ?? skippedState?.error}</p>
      )}

      <div className="flex gap-3">
        <form action={fixedFormAction}>
          <input type="hidden" name="key" value={finding.key} />
          <input type="hidden" name="action" value="fixed" />
          <input type="hidden" name="nextStep" value={nextStep} />
          <SubmitButton pendingLabel="Saving…">I fixed this</SubmitButton>
        </form>
        <form action={skippedFormAction}>
          <input type="hidden" name="key" value={finding.key} />
          <input type="hidden" name="action" value="skipped" />
          <input type="hidden" name="nextStep" value={nextStep} />
          <SubmitButton variant="outline" pendingLabel="Saving…">
            Skip for now
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}

// Read-only redisplay when the candidate navigates back to an already-
// handled finding — its own tiny form just to carry the primary "Continue"
// action forward without re-resolving anything.
function ContinueForm({
  nextStep,
  findingKey,
  handledAction,
}: {
  nextStep: number
  findingKey: string
  handledAction: 'fixed' | 'skipped'
}) {
  const [state, formAction, pending] = useActionState(resolveMechanicalFindingAction, undefined)
  return (
    <form action={formAction} className={pending ? 'cursor-progress [&_*]:cursor-progress' : ''}>
      <input type="hidden" name="key" value={findingKey} />
      <input type="hidden" name="action" value={handledAction} />
      <input type="hidden" name="nextStep" value={nextStep} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Loading…">Continue</SubmitButton>
    </form>
  )
}
