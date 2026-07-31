'use client'

import { useState } from 'react'
import type { SurfacedJob, NotInterestedReason } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { reactToSurfacedJob, recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { FIT_BUCKET_LABEL, isRecentlyListed, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { cn } from '@/lib/utils'

const FIT_BUCKET_STYLE: Record<FitBucket, string> = {
  strong: 'bg-success/10 text-success',
  good: 'bg-brand/10 text-brand',
  stretch: 'bg-muted text-muted-foreground',
  overqualified: 'bg-muted text-muted-foreground',
}

const REASON_OPTIONS: { value: NotInterestedReason; label: string }[] = [
  { value: 'WRONG_FUNCTION', label: 'Wrong function' },
  { value: 'WRONG_INDUSTRY', label: 'Wrong industry' },
  { value: 'COMP_TOO_LOW', label: 'Compensation too low' },
  { value: 'SENIORITY_MISMATCH', label: 'Too senior or too junior' },
  { value: 'LOCATION_MISMATCH', label: 'Location or flexibility mismatch' },
  { value: 'MISSING_EXPERIENCE', label: 'Missing required experience' },
  { value: 'COMPANY_UNATTRACTIVE', label: 'Company unattractive' },
  { value: 'DONT_FEEL_QUALIFIED', label: "Sounds interesting but I don't feel qualified" },
  { value: 'WOULD_PURSUE_WITH_CONNECTION', label: 'Would pursue if I had a connection inside' },
]

// One-at-a-time surfaced job — Interested/Not Interested only (no "Unsure").
// Reacting removes it from the unreacted queue server-side, and the next
// render naturally shows whatever's next — no client-side "advance" state.
export function NextSurfacedJobCard({ job, fitBucket }: { job: SurfacedJob; fitBucket?: FitBucket }) {
  const [showReasons, setShowReasons] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              void recordJobClick({
                source: 'surfaced',
                sourceId: job.id,
                jobTitle: job.title,
                companyName: job.companyName,
                location: job.location,
                url: job.url,
                fitBucket: fitBucket ?? null,
              })
            }}
          >
            {job.title}
          </a>
          {(job.companyName || job.location) && (
            <p className="text-sm text-muted-foreground">
              {[job.companyName, job.location].filter(Boolean).join(' — ')}
            </p>
          )}
          {job.description && (
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{job.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isRecentlyListed(job.surfacedAt) && (
            <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">New</span>
          )}
          {fitBucket && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', FIT_BUCKET_STYLE[fitBucket])}>
              {FIT_BUCKET_LABEL[fitBucket]}
            </span>
          )}
        </div>
      </div>

      {!showReasons ? (
        <div className="flex flex-wrap gap-2">
          <form
            action={reactToSurfacedJob.bind(null, job.id, 'INTERESTED', null)}
            onSubmit={() => setPending(true)}
          >
            <Button type="submit" size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
              Interested
            </Button>
          </form>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowReasons(true)}>
            Not Interested
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Why not?</p>
          <div className="flex flex-wrap gap-2">
            {REASON_OPTIONS.map((reason) => (
              <form
                key={reason.value}
                action={reactToSurfacedJob.bind(null, job.id, 'NOT_INTERESTED', reason.value)}
                onSubmit={() => setPending(true)}
              >
                <Button type="submit" variant="outline" size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
                  {reason.label}
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
