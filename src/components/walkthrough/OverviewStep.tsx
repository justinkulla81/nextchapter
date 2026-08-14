'use client'

import { useActionState } from 'react'
import { advanceOverviewStepAction } from '@/app/dashboard/resume/walkthrough/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function OverviewStep({ nextStep, estimatedMinutes }: { nextStep: number; estimatedMinutes: number }) {
  const [state, formAction, pending] = useActionState(advanceOverviewStepAction, undefined)

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-3 text-sm text-foreground">
        <p>
          We&apos;ll go through your resume one issue at a time — about {estimatedMinutes} minutes total. Nothing
          changes until you approve it.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>A batch of formatting and ATS fixes</li>
          <li>Your one-line target statement</li>
          <li>A few thin bullets, filled in from your own answers</li>
          <li>A couple of things a reviewer might ask about</li>
        </ul>
        <p className="text-muted-foreground">
          Every detection here is a question, not a verdict — if we read something wrong, you can correct it, mark
          it not applicable, or leave it for now. Your progress saves automatically, so you can stop anytime and
          pick up right where you left off.
        </p>
      </div>

      <input type="hidden" name="nextStep" value={nextStep} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Starting…">Start walkthrough</SubmitButton>
    </form>
  )
}
