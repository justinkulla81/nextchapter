'use client'

import { useState } from 'react'
import type { SurfacedJob, NotInterestedReason } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { reactToSurfacedJob, recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { FIT_BUCKET_LABEL, isRecentlyListed, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { cn } from '@/lib/utils'

const FIT_BUCKET_STYLE: Record<FitBucket, string> = {
  strong: 'bg-success/10 text-success',
  good: 'bg-brand/10 text-brand',
  stretch: 'bg-muted text-muted-foreground',
  below_level: 'bg-muted text-muted-foreground',
  overqualified: 'bg-muted text-muted-foreground',
}

function FitBadge({ bucket }: { bucket: FitBucket }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', FIT_BUCKET_STYLE[bucket])}>
      {FIT_BUCKET_LABEL[bucket]}
    </span>
  )
}

function NewBadge() {
  return <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">New</span>
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
// Same collapsed <details> shape as DiscoverJobCard/LockedDiscoverJobCard so
// all three sit in one shared list without a formatting seam between them.
export function NextSurfacedJobCard({
  job,
  fitBucket,
  worksHereContacts,
  worksHereTotalCount,
}: {
  job: SurfacedJob
  fitBucket?: FitBucket
  // Read-only company-name match against the candidate's own contact list —
  // unlike WhoCanHelpSection (used on applied jobs), there's no JobPosting
  // row here to link a contact to, so this is informational only: a warm
  // intro is the biggest differentiator among hundreds of applicants, so
  // it's worth surfacing even before the candidate has applied. Callers
  // pre-sort by contactLinkType (email, then LinkedIn, then neither) and cap
  // the list — worksHereTotalCount carries the real count for a "+N more".
  worksHereContacts?: { id: string; name: string; email: string | null; linkedinUrl: string | null }[]
  worksHereTotalCount?: number
}) {
  const [showReasons, setShowReasons] = useState(false)
  const [pending, setPending] = useState(false)

  function handleClick() {
    void recordJobClick({
      source: 'surfaced',
      sourceId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      location: job.location,
      url: job.url,
      fitBucket: fitBucket ?? null,
    })
  }

  return (
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium text-foreground">{job.title}</span>
          {job.companyName && <span className="truncate text-sm text-muted-foreground">at {job.companyName}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {isRecentlyListed(job.surfacedAt) && <NewBadge />}
          {fitBucket && <FitBadge bucket={fitBucket} />}
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        {job.location && <p className="text-sm text-muted-foreground">{job.location}</p>}

        {job.description && <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}

        {worksHereContacts && worksHereContacts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span>Who can help: </span>
            {worksHereContacts.map((c) => c.name).join(', ')}
            {worksHereTotalCount !== undefined && worksHereTotalCount > worksHereContacts.length && (
              <span> +{worksHereTotalCount - worksHereContacts.length} more</span>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            nativeButton={false}
            render={<a href={job.url} target="_blank" rel="noopener noreferrer" onClick={handleClick} />}
            variant="outline"
            size="sm"
          >
            View posting
          </Button>

          {!showReasons ? (
            <>
              <form action={reactToSurfacedJob.bind(null, job.id, 'INTERESTED', null)} onSubmit={() => setPending(true)}>
                <SubmitButton size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
                  Interested
                </SubmitButton>
              </form>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowReasons(true)}>
                Not Interested
              </Button>
            </>
          ) : (
            <div className="w-full space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Why not?</p>
              <div className="flex flex-wrap gap-2">
                {REASON_OPTIONS.map((reason) => (
                  <form
                    key={reason.value}
                    action={reactToSurfacedJob.bind(null, job.id, 'NOT_INTERESTED', reason.value)}
                    onSubmit={() => setPending(true)}
                  >
                    <SubmitButton variant="outline" size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
                      {reason.label}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  )
}
