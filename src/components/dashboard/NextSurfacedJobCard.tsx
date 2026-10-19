'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SurfacedJob, NotInterestedReason } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { reactToSurfacedJob, recordJobClick } from '@/app/dashboard/find-my-job/actions'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import { cardMetaParts, cardVerdict } from '@/lib/jobs/job-card'
import { postedAgo } from '@/lib/jobs/competition'
import { JobMetaLine, JobVerdict } from '@/components/jobs/JobCardParts'
import { classifyWorkType } from '@/lib/jobs/work-type'
import type { CardTrackState } from '@/lib/jobs/my-jobs-data'
import { JobTrackControls } from '@/components/dashboard/one-board/JobTrackControls'

export const REASON_OPTIONS: { value: NotInterestedReason; label: string }[] = [
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
// Same collapsed <details> shape as DiscoverJobCard so
// all three sit in one shared list without a formatting seam between them.
export function NextSurfacedJobCard({
  job,
  fitBucket,
  worksHereContacts,
  worksHereTotalCount,
  track,
  watched,
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
  track?: CardTrackState
  watched?: boolean
}) {
  const workType = classifyWorkType(job)
  // A partner-search job has no posting date, only when we found it.
  const found = postedAgo({ postedAt: null, createdAt: job.surfacedAt }).replace(/^Posted/, 'Found')
  const meta = cardMetaParts({ posted: found, location: job.location, pay: null, workType, title: job.title })
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
      workType,
    })
  }

  return (
    <details className="group">
      <summary className="block cursor-pointer list-none px-4 py-3">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-foreground">{job.title}</span>
              {job.companyName && <span className="text-sm text-muted-foreground">at {job.companyName}</span>}
            </span>
            {fitBucket && <JobVerdict verdict={cardVerdict(fitBucket)} className="mt-1 inline-block sm:hidden" />}
            <JobMetaLine parts={meta} jobId={job.id} />
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {fitBucket && <JobVerdict verdict={cardVerdict(fitBucket)} className="hidden sm:inline-block" />}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
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
              <JobTrackControls
                jobRef={{ source: 'surfaced', sourceId: job.id, title: job.title, companyName: job.companyName, url: job.url, workType }}
                initial={track}
                watched={watched}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShowReasons(true)}>
                Not interested
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
