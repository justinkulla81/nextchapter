'use client'

import { useActionState, useState } from 'react'
import { updateJobBoardUsage, type JobBoardUsageState } from '@/app/dashboard/find-my-job/actions'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

type Frequency = 'daily' | 'few_times_week' | 'rarely' | 'never'

const FREQUENCY_OPTIONS: readonly { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'few_times_week', label: 'A few times a week' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Not at all' },
]

const BOARDS: readonly { key: string; label: string }[] = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'indeed', label: 'Indeed' },
  { key: 'ziprecruiter', label: 'ZipRecruiter' },
  { key: 'company_pages', label: 'Company career pages directly' },
]

export function JobBoardUsageCheckIn({
  currentUsage,
}: {
  currentUsage: Record<string, string> | null
}) {
  const [state, formAction, pending] = useActionState<JobBoardUsageState, FormData>(
    updateJobBoardUsage,
    undefined
  )
  const [values, setValues] = useState<Record<string, Frequency | null>>(() =>
    Object.fromEntries(BOARDS.map((b) => [b.key, (currentUsage?.[b.key] as Frequency) ?? null]))
  )

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="text-sm font-semibold text-foreground">
        Which job boards do you currently use, and how much?
      </p>
      <form action={formAction} className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
        {BOARDS.map((board) => (
          <div key={board.key}>
            <p className="mb-1 text-sm text-muted-foreground">{board.label}</p>
            <ChoiceButtons
              name={board.key}
              options={FREQUENCY_OPTIONS}
              value={values[board.key] ?? null}
              onChange={(v) => setValues((prev) => ({ ...prev, [board.key]: v }))}
            />
          </div>
        ))}
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>

      {state?.nudge && (
        <div className="rounded-md border border-brand/30 bg-brand/5 p-3">
          <p className="text-sm font-medium text-foreground">{state.nudge.title}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {state.nudge.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
