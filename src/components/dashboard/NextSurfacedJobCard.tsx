'use client'

import { useState } from 'react'
import type { SurfacedJob, NotInterestedReason } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { reactToSurfacedJob } from '@/app/dashboard/job-fit/actions'

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
export function NextSurfacedJobCard({ job }: { job: SurfacedJob }) {
  const [showReasons, setShowReasons] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          {job.title}
        </a>
        {(job.companyName || job.location) && (
          <p className="text-sm text-muted-foreground">
            {[job.companyName, job.location].filter(Boolean).join(' — ')}
          </p>
        )}
        {job.description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{job.description}</p>
        )}
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
            Not interested
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
