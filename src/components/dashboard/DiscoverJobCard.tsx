'use client'

import { useActionState } from 'react'
import { Lock } from 'lucide-react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { promoteJobBoardListing, requestJobBoardIntro, recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { FIT_BUCKET_LABEL, isRecentlyListed, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { AddToWatchlistButton } from '@/components/dashboard/AddToWatchlistButton'
import { cn } from '@/lib/utils'

const POSTING_TYPE_LABEL: Record<string, string> = {
  direct: 'Direct Employer',
  recruiter_search: 'Recruiter-Led Search',
}

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

// A-List-only listing a non-A candidate can't see yet — shown masked
// rather than omitted, so the board itself is a visible reason to reach an
// A instead of a wall these candidates never even know exists.
export function LockedDiscoverJobCard({ posting }: { posting: Pick<ExclusiveJobPosting, 'postingType' | 'location' | 'salaryCurrency' | 'salaryMin' | 'salaryMax'> }) {
  return (
    <div className="space-y-1 bg-off-white/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-orange" />
        <p className="text-sm font-medium text-orange">A-List-exclusive opportunity — locked</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {posting.postingType && POSTING_TYPE_LABEL[posting.postingType]}
        {posting.location && ` · ${posting.location}`}
        {posting.salaryMin && posting.salaryMax &&
          ` · ${posting.salaryCurrency ?? 'USD'} ${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`}
      </p>
      <p className="text-sm text-muted-foreground">Reach an A grade to see who&apos;s hiring and apply.</p>
    </div>
  )
}

export function DiscoverJobCard({
  posting,
  fitBucket,
}: {
  posting: ExclusiveJobPosting
  fitBucket: FitBucket
}) {
  const [state, formAction, pending] = useActionState(promoteJobBoardListing.bind(null, posting.id), undefined)
  const confidential = posting.disclosure === 'CONFIDENTIAL'

  function handleClick() {
    void recordJobClick({
      source: 'job_board',
      sourceId: posting.id,
      jobTitle: posting.title,
      companyName: posting.companyName,
      location: posting.location,
      url: posting.url,
      fitBucket,
    })
  }

  return (
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium text-foreground">{posting.title}</span>
          <span className="truncate text-sm text-muted-foreground">
            {confidential ? 'Confidential search' : `at ${posting.companyName}`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {isRecentlyListed(posting.createdAt) && <NewBadge />}
          <FitBadge bucket={fitBucket} />
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {posting.postingType && POSTING_TYPE_LABEL[posting.postingType]}
          {posting.location && ` · ${posting.location}`}
          {posting.salaryMin && posting.salaryMax &&
            ` · ${posting.salaryCurrency ?? 'USD'} ${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`}
        </p>

        {posting.description && <p className="text-sm text-muted-foreground">{posting.description}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {confidential ? (
            <RequestIntroButton postingId={posting.id} />
          ) : (
            <Button
              nativeButton={false}
              render={<a href={posting.url} target="_blank" rel="noopener noreferrer" onClick={handleClick} />}
              variant="outline"
              size="sm"
            >
              View posting
            </Button>
          )}
          {state?.jobPostingId ? (
            <p className="text-sm text-success">Added to My Applications, with a full fit analysis below.</p>
          ) : (
            <form action={formAction}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Analyzing…" className={pending ? 'cursor-progress' : ''}>
                See full fit &amp; tailor your approach
              </SubmitButton>
            </form>
          )}
          {!confidential && <AddToWatchlistButton companyName={posting.companyName} />}
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </details>
  )
}

function RequestIntroButton({ postingId }: { postingId: string }) {
  return (
    <form action={requestJobBoardIntro.bind(null, postingId)}>
      <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
        Request intro
      </SubmitButton>
    </form>
  )
}
