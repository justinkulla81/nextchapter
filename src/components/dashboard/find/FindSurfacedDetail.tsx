'use client'

import { useState } from 'react'
import type { SurfacedJob } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { Avatar, Section } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { reactToSurfacedJob, recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { cardMetaParts } from '@/lib/jobs/job-card'
import { postedAgo } from '@/lib/jobs/competition'
import { classifyWorkType } from '@/lib/jobs/work-type'
import { posthog } from '@/lib/posthog/client'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { JobListItem } from '@/lib/jobs/find-list'
import type { CardTrackState } from '@/lib/jobs/my-jobs-data'
import { JobTrackControls } from '@/components/dashboard/one-board/JobTrackControls'
import { REASON_OPTIONS } from '@/components/dashboard/NextSurfacedJobCard'
import { cn } from '@/lib/utils'

// The open job for a partner-search match (a job found by our automated searches, not on the board).
// Same shape as FindJobDetail: apply first, then why it is here and who can help, with "Not interested"
// and its reasons kept (reacting removes it from the queue on the next load).
export function FindSurfacedDetail({
  job,
  item,
  fitBucket,
  worksHereContacts,
  worksHereTotalCount,
  track,
  watched,
}: {
  job: SurfacedJob
  item: JobListItem
  fitBucket?: FitBucket
  worksHereContacts?: { id: string; name: string }[]
  worksHereTotalCount?: number
  track?: CardTrackState
  watched?: boolean
}) {
  const workType = classifyWorkType(job)
  const found = postedAgo({ postedAt: null, createdAt: job.surfacedAt }).replace(/^Posted/, 'Found')
  const meta = cardMetaParts({ posted: found, location: job.location, pay: null, workType, title: job.title })
  const [showReasons, setShowReasons] = useState(false)
  const [pending, setPending] = useState(false)
  const helpers = worksHereContacts ?? []

  return (
    <article className="space-y-7 rounded-2xl border border-border bg-white p-5 sm:p-7" aria-label={`${job.title} at ${item.company}`}>
      <header className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar name={item.company} size="lg" />
          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-2xl leading-tight font-semibold text-ink">{job.title}</h2>
            <p className="text-base text-ink">{item.company}</p>
            <p className="text-sm text-muted-foreground">Found by your automated searches · {meta.join(' · ')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ActionLink
            href={job.url}
            external
            kind="dark"
            event="job_apply_opened"
            props={{ jobId: job.id, source: 'find_pane', kind: 'surfaced', fitBucket: fitBucket ?? null }}
            onClick={() =>
              void recordJobClick({ source: 'surfaced', sourceId: job.id, jobTitle: job.title, companyName: job.companyName, location: job.location, url: job.url, fitBucket: fitBucket ?? null, workType })
            }
          >
            Apply
          </ActionLink>
          {!showReasons && (
            <>
              <JobTrackControls jobRef={{ source: 'surfaced', sourceId: job.id, title: job.title, companyName: job.companyName, url: job.url, workType }} initial={track} watched={watched} />
              <button type="button" onClick={() => setShowReasons(true)} className="text-sm font-medium text-brand underline underline-offset-4">
                Not interested
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Apply opens the posting in a new tab.</p>
        {showReasons && (
          <div className="space-y-2" role="group" aria-label="Why not?">
            <p className="text-sm font-medium text-ink">Why not?</p>
            <div className="flex flex-wrap gap-2">
              {REASON_OPTIONS.map((reason) => (
                <form
                  key={reason.value}
                  action={reactToSurfacedJob.bind(null, job.id, 'NOT_INTERESTED', reason.value)}
                  onSubmit={() => {
                    setPending(true)
                    posthog.capture('surfaced_job_passed', { jobId: job.id, reason: reason.value, source: 'find_pane' })
                  }}
                >
                  <SubmitButton variant="outline" size="sm" disabled={pending} className={cn(pending && 'cursor-progress')}>
                    {reason.label}
                  </SubmitButton>
                </form>
              ))}
            </div>
          </div>
        )}
      </header>

      <Section id={`fit-${job.id}`} title="Why this is here">
        <p className="text-lg text-ink">
          {item.verdictLabel && <span className={cn('font-semibold', item.verdict === 'worth_a_look' ? 'text-ink' : 'text-success')}>{item.verdictLabel}.</span>} {item.reason}
        </p>
      </Section>

      {helpers.length > 0 && (
        <Section id={`help-${job.id}`} title="Who can help you get in">
          <p className="text-base text-ink">
            {helpers.map((c) => c.name).join(', ')}
            {worksHereTotalCount !== undefined && worksHereTotalCount > helpers.length && ` and ${worksHereTotalCount - helpers.length} more`} in your network
            {helpers.length === 1 ? ' works' : ' work'} at {job.companyName}.
          </p>
          <p className="text-sm text-muted-foreground">An introduction from someone inside beats a cold application.</p>
        </Section>
      )}

      {job.description && (
        <Section id={`role-${job.id}`} title="About the role">
          <p className="line-clamp-4 text-sm text-muted-foreground">{job.description}</p>
        </Section>
      )}
    </article>
  )
}
