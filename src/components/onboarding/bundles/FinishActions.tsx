'use client'

import { useActionState, useState } from 'react'
import { answerNextQuestion, finishBundles } from '@/app/onboarding/bundle-actions'
import { usePostHog } from '@/lib/posthog/client'
import type { NextQuestion } from '@/lib/onboarding/finish'
import { cn } from '@/lib/utils'
import { OptionButtons } from './OptionButtons'
import { PrimaryAction } from './PrimaryAction'

// The end of the bundles: one optional next question (skippable by simply continuing), then the one primary action.
// Answering saves at once, says what it changed, and never blocks the way on.
export function FinishActions({ question, continueLabel }: { question: NextQuestion | null; continueLabel: string }) {
  const [state, save, saving] = useActionState(answerNextQuestion, undefined)
  const [value, setValue] = useState('')
  const posthog = usePostHog()
  const saved = state?.saved === true

  return (
    <div className="space-y-8">
      {question && (
        <form action={save} className={cn('space-y-3 rounded-2xl border border-border p-5', saving && 'cursor-progress [&_*]:cursor-progress')}>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">One more, if you like</p>
          <OptionButtons name="value" legend={question.label} help={`Optional. ${question.gain}`} options={question.options} value={value} onChange={(v) => { setValue(v); if (v) posthog?.capture('onboarding_question_answered', { bundleId: 'finish', questionId: question.id }) }} />
          {state?.error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          {saved ? (
            <p role="status" className="text-sm font-medium text-ink">
              Saved. {question.gain}
            </p>
          ) : (
            <button
              type="submit"
              disabled={!value || saving}
              className={cn('inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60', saving ? 'cursor-progress' : !value ? 'cursor-not-allowed' : 'cursor-pointer')}
            >
              {saving ? 'Saving…' : 'Save my answer'}
            </button>
          )}
          {!value && !saved && <p className="text-sm text-muted-foreground">Choose an answer to save it, or skip this and continue.</p>}
        </form>
      )}

      <form action={finishBundles} className="space-y-2">
        <input type="hidden" name="nextQuestionAnswered" value={saved ? '1' : '0'} />
        <PrimaryAction pendingLabel="One moment…">{continueLabel}</PrimaryAction>
      </form>
    </div>
  )
}
