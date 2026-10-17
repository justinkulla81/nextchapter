'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'

/**
 * "Hide jobs I can't take" (off by default): leaves out jobs with a hard
 * requirement the member told us they don't meet — a clearance, citizenship,
 * sponsorship, a license, travel or onsite work (requirements.ts). Unanswered
 * questions never hide a job. "Cleared jobs" shows only for members who hold a
 * clearance: jobs asking for one their clearance meets. Both live in the URL
 * (`blockers=hide`, `cleared=1`), so a reload or shared link keeps them.
 */
export function RequirementFilters({
  surface,
  hideBlockers,
  clearedOnly,
  holdsClearance,
}: {
  surface: string
  hideBlockers: boolean
  clearedOnly: boolean
  holdsClearance: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function go(changes: { blockers?: string | null; cleared?: string | null }) {
    startTransition(() => router.replace(boardHref(searchParams, changes, { pathname }), { scroll: false }))
  }

  const btn = (on: boolean) =>
    cn(
      'rounded-md border px-2 py-1 text-sm',
      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
      pending && 'cursor-wait'
    )

  return (
    <div className={cn('flex flex-wrap gap-1', pending && 'cursor-wait')}>
      <button
        type="button"
        aria-pressed={hideBlockers}
        aria-busy={pending}
        disabled={pending}
        title="Leave out jobs that require something you told us you don't have (a clearance, citizenship, a license, travel or onsite work)"
        className={btn(hideBlockers)}
        onClick={() => {
          posthog.capture('requirement_blocker_filter_toggled', { on: !hideBlockers, surface })
          go({ blockers: hideBlockers ? null : 'hide' })
        }}
      >
        Hide jobs I can&apos;t take
      </button>
      {holdsClearance && (
        <button
          type="button"
          aria-pressed={clearedOnly}
          aria-busy={pending}
          disabled={pending}
          title="Only jobs that ask for a security clearance yours meets"
          className={btn(clearedOnly)}
          onClick={() => {
            if (!clearedOnly) posthog.capture('cleared_jobs_filter_used', { surface })
            go({ cleared: clearedOnly ? null : '1' })
          }}
        >
          Cleared jobs
        </button>
      )}
    </div>
  )
}
