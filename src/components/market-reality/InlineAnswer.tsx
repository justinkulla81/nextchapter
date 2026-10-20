'use client'

import { useActionState } from 'react'
import { answerReportQuestion } from '@/app/dashboard/market-reality/answer-actions'
import { ANSWER_CONTROLS, type AnswerField } from '@/lib/reports/market-reality-brief/answers'
import { NativeSelect } from '@/components/ui/native-select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

/** Answer one question in place. Saves to the field it belongs to and the report recalculates. */
export function InlineAnswer({ field, className }: { field: AnswerField; className?: string }) {
  const control = ANSWER_CONTROLS[field]
  const [state, formAction, pending] = useActionState(answerReportQuestion, undefined)
  const id = `answer-${field}`
  return (
    <form
      action={(fd) => {
        posthog.capture('market_reality_inline_answer_submitted', { field })
        return formAction(fd)
      }}
      className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-progress [&_*]:cursor-progress', className)}
    >
      <input type="hidden" name="field" value={field} />
      <label htmlFor={id} className="sr-only">
        {control.label}
      </label>
      {control.kind === 'select' ? (
        <NativeSelect id={id} name="value" options={control.options ?? []} placeholder={control.placeholder} className="w-auto min-w-[14rem]" />
      ) : (
        <Input id={id} name="value" type="url" inputMode="url" placeholder={control.placeholder} className="h-9 w-80 max-w-full" />
      )}
      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
        {control.submit}
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="basis-full text-sm text-muted-foreground">Saved. The report has been updated.</p>}
    </form>
  )
}
