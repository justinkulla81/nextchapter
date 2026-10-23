'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUSES, JOB_STATUS_LABEL, type ApplicationStatus } from '@/lib/jobs/my-jobs'
import { setApplicationStatusById } from '@/app/dashboard/find-my-job/my-jobs-actions'

/** Applied / Interviewing / Offer / Closed for an application found in Gmail or logged in the tracker. */
export function ApplicationStatusButtons({ jobPostingId, title, initial }: { jobPostingId: string; title: string; initial: ApplicationStatus | null }) {
  const [status, setStatus] = useState<ApplicationStatus | null>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function change(to: ApplicationStatus) {
    if (to === status) return
    const before = status
    setStatus(to)
    setError(null)
    startTransition(async () => {
      const r = await setApplicationStatusById(jobPostingId, to)
      if (!r.ok) {
        setStatus(before)
        setError(r.error)
      }
    })
  }

  return (
    <div className={cn('space-y-1', pending && 'cursor-wait')} aria-busy={pending}>
      <div role="group" aria-label={`Application status for ${title}`} className="flex flex-wrap gap-1">
        {APPLICATION_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => change(s)}
            aria-pressed={status === s}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium',
              status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
          >
            {JOB_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
