'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { updateJobBoardUsage, type JobBoardUsageState } from '@/app/dashboard/find-my-job/actions'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

type Frequency = 'daily' | 'few_times_week' | 'rarely' | 'never'

const FREQUENCY_OPTIONS: readonly { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'few_times_week', label: 'A few times a week' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Not at all' },
]

// ZipRecruiter deliberately absent — its posting mix skews well below the
// level candidates here target, and listing a board implies we think it's
// worth their time. TheLadders takes that slot as the executive-focused one.
const BOARDS: readonly { key: string; label: string }[] = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'indeed', label: 'Indeed' },
  { key: 'theladders', label: 'TheLadders' },
  { key: 'company_pages', label: 'Company career pages directly' },
]

export function JobBoardUsageCheckIn({
  currentUsage,
  currentOther,
  alreadyAwarded,
}: {
  currentUsage: Record<string, string> | null
  currentOther: string | null
  alreadyAwarded: boolean
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Which job boards do you currently use, and how much?
        </p>
        {!alreadyAwarded && (
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            +5 pts, one time
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        This tells us where you&apos;re already looking, so we don&apos;t just send you back to the
        same boards. Answer once — you can update it any time.
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
        <div>
          <label htmlFor="job-board-other" className="mb-1 block text-sm text-muted-foreground">
            Any other boards you use?
          </label>
          <Input
            id="job-board-other"
            name="other"
            defaultValue={currentOther ?? ''}
            placeholder="e.g. Otta, Built In, Dice, an industry association board"
          />
        </div>
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>

      {/* Boards are the passive channel. The two highest-leverage moves at
          this level are a coach and a recruiter relationship, so they're
          offered right where the candidate is thinking about their search
          channels rather than buried in nav. */}
      <div className="rounded-md border border-border bg-off-white p-3">
        <p className="text-sm text-foreground">
          Boards are the crowded channel. At senior levels most roles move through people.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="/coaching" className="font-medium text-primary underline underline-offset-4">
            Talk to a career coach
          </Link>
          <Link href="/dashboard/network" className="font-medium text-primary underline underline-offset-4">
            Get in front of executive recruiters
          </Link>
        </div>
      </div>

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
