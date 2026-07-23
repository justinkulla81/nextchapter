'use client'

import { useActionState } from 'react'
import { Lock } from 'lucide-react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { promoteJobBoardListing, requestJobBoardIntro } from '@/app/dashboard/find-my-job/actions'
import { FIT_BUCKET_LABEL, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { cn } from '@/lib/utils'

const POSTING_TYPE_LABEL: Record<string, string> = {
  direct: 'Direct Employer',
  recruiter_search: 'Recruiter-Led Search',
}

const FIT_BUCKET_STYLE: Record<FitBucket, string> = {
  strong: 'bg-success/10 text-success',
  good: 'bg-brand/10 text-brand',
  stretch: 'bg-muted text-muted-foreground',
}

function FitBadge({ bucket }: { bucket: FitBucket }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', FIT_BUCKET_STYLE[bucket])}>
      {FIT_BUCKET_LABEL[bucket]}
    </span>
  )
}

// A-List-only listing a non-A candidate can't see yet — shown masked
// rather than omitted, so the board itself is a visible reason to reach an
// A instead of a wall these candidates never even know exists.
export function LockedDiscoverJobCard({ posting }: { posting: Pick<ExclusiveJobPosting, 'postingType' | 'location' | 'salaryCurrency' | 'salaryMin' | 'salaryMax'> }) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-light-gray bg-off-white p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">A-List-exclusive opportunity — locked</p>
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

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {confidential ? (
            <p className="font-medium text-foreground">
              {posting.title} <span className="text-muted-foreground">— confidential search</span>
            </p>
          ) : (
            <a
              href={posting.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {posting.title} at {posting.companyName}
            </a>
          )}
          <p className="text-sm text-muted-foreground">
            {posting.postingType && POSTING_TYPE_LABEL[posting.postingType]}
            {posting.location && ` · ${posting.location}`}
            {posting.salaryMin && posting.salaryMax &&
              ` · ${posting.salaryCurrency ?? 'USD'} ${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`}
          </p>
        </div>
        <FitBadge bucket={fitBucket} />
      </div>

      {posting.description && <p className="text-sm text-muted-foreground">{posting.description}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {confidential ? (
          <RequestIntroButton postingId={posting.id} />
        ) : (
          <Button
            nativeButton={false}
            render={<a href={posting.url} target="_blank" rel="noopener noreferrer" />}
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
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
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
