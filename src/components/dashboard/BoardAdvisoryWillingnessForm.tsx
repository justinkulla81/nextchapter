'use client'

import { useActionState, useState } from 'react'
import { updateBoardAdvisoryWillingness } from '@/app/dashboard/search-strategy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

export function BoardAdvisoryWillingnessForm({ initial }: { initial: boolean | null }) {
  const [state, formAction, pending] = useActionState(updateBoardAdvisoryWillingness, undefined)
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(
    initial === null ? null : initial ? 'yes' : 'no'
  )

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <ChoiceButtons name="answer" options={YES_NO_OPTIONS} value={answer} onChange={setAnswer} columns={2} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save answer</SubmitButton>
    </form>
  )
}
