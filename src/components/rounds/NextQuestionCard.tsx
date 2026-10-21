'use client'

import { useActionState, useState } from 'react'
import { answerNextQuestion } from '@/app/onboarding/bundle-actions'
import { OptionButtons } from '@/components/onboarding/bundles/OptionButtons'
import type { NextQuestion } from '@/lib/onboarding/finish'
import { cn } from '@/lib/utils'

type SaveNext = (prev: { saved?: boolean; error?: string } | undefined, formData: FormData) => Promise<{ saved?: boolean; error?: string }>

// The one optional question on a finish screen. Answering saves at once and says what it changed; skipping is
// just carrying on. `save` is the real action unless a dev preview hands in a stand-in. Same pattern as the
// onboarding finish (FinishActions), kept apart so that page is untouched.
export function NextQuestionCard({ question, save = answerNextQuestion, onAnswered }: { question: NextQuestion; save?: SaveNext; onAnswered?: (questionId: string, value: string) => void }) {
  const [state, action, saving] = useActionState(save, undefined)
  const [value, setValue] = useState('')
  const saved = state?.saved === true
  return (
    <form action={action} className={cn('space-y-3 rounded-2xl border border-border p-5', saving && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">One more, if you like</p>
      <OptionButtons name="value" legend={question.label} help={`Optional. ${question.gain}`} options={question.options} value={value} onChange={setValue} />
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
        <div className="space-y-2">
          <button
            type="submit"
            disabled={!value || saving}
            onClick={() => value && onAnswered?.(question.id, value)}
            className={cn('inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60', saving ? 'cursor-progress' : !value ? 'cursor-not-allowed' : 'cursor-pointer')}
          >
            {saving ? 'Saving…' : 'Save my answer'}
          </button>
          {!value && <p className="text-sm text-muted-foreground">Choose an answer to save it, or skip this: it is optional.</p>}
        </div>
      )}
    </form>
  )
}
