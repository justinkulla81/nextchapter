'use client'

import { useActionState, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { resolveMechanicalFindingAction } from '@/app/dashboard/resume/walkthrough/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import type { MechanicalBatchFinding } from '@/lib/walkthrough/mechanical-findings'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'

const SEVERITY_LABEL: Record<string, string> = { HIGH: 'High impact', MEDIUM: 'Medium impact', LOW: 'Worth a look' }

function SuggestedRewriteBox({ text, findingKey }: { text: string; findingKey: string }) {
  const posthog = usePostHog()
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-brand uppercase">Suggested rewrite</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true)
              posthog?.capture('resume_rewrite_suggestion_copied', { findingKey })
              setTimeout(() => setCopied(false), 2000)
            })
          }}
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <p className="text-sm text-foreground">{text}</p>
      <p className="text-xs text-muted-foreground">
        Starting point, not a finished bullet — fill in any bracketed placeholder with your own real
        details before using it.
      </p>
    </div>
  )
}

export function MechanicalFindingStep({
  finding,
  suggestedRewrite,
  handledAction,
  nextStep,
}: {
  finding: MechanicalBatchFinding
  // AI-generated, batched once per resume (see rewrite-suggestions.ts) —
  // null while generation is still running (rare; kicked off on the
  // overview step) or if this finding has no clean single-sentence fix.
  // Never a fabricated number: a "quantify this" fix comes back with a
  // bracketed placeholder for the candidate's own real figure.
  suggestedRewrite: string | null
  handledAction: 'fixed' | 'skipped' | null
  nextStep: number
}) {
  const [fixedState, fixedFormAction, fixedPending] = useActionState(resolveMechanicalFindingAction, undefined)
  const [skippedState, skippedFormAction, skippedPending] = useActionState(resolveMechanicalFindingAction, undefined)

  if (handledAction) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">{finding.finding.candidateFacingCopy}</p>
        {suggestedRewrite && <SuggestedRewriteBox text={suggestedRewrite} findingKey={finding.key} />}
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

      {suggestedRewrite && <SuggestedRewriteBox text={suggestedRewrite} findingKey={finding.key} />}

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
