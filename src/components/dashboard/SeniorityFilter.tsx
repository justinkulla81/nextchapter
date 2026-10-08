'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { SENIORITY_GROUPS } from '@/lib/jobs/job-seniority'
import { cn } from '@/lib/utils'

/**
 * Narrows a job list to one seniority group (job-seniority.ts) through the
 * `seniority` URL parameter, so the server renders only matching jobs and
 * the choice survives a reload or a shared link. Seven choices, so a
 * select rather than buttons.
 */
export function SeniorityFilter({ surface }: { surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = searchParams.get('seniority') ?? ''

  function onChange(value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set('seniority', value)
    else next.delete('seniority')
    posthog.capture('job_seniority_filter_changed', { surface, seniority: value || 'ALL' })
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  return (
    <label className={cn('flex items-center gap-2 text-sm text-muted-foreground', pending && 'cursor-wait')}>
      Seniority
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-busy={pending}
        className={cn('rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground', pending && 'cursor-wait')}
      >
        <option value="">All levels</option>
        {SENIORITY_GROUPS.map((g) => (
          <option key={g.key} value={g.key}>
            {g.label}
          </option>
        ))}
      </select>
    </label>
  )
}
