'use client'

import { useState, useTransition } from 'react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DiscoverJobCard } from '@/components/dashboard/DiscoverJobCard'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import { loadMoreAtLevel } from '@/app/dashboard/find-my-job/breadth-actions'

const PAGE = 20

/**
 * Wide's "More jobs at your level": every other job in the member's level window,
 * best fit first. The first page comes with the board; each "Show more" loads the
 * next page of the ids the board already ranked, so the page never holds more than
 * the member asked to see.
 */
export function MoreAtLevelSection({
  total,
  ids,
  first,
  firstFitBuckets,
  surface,
}: {
  total: number
  /** Ranked ids (best fit first), at most MORE_AT_LEVEL_MAX. */
  ids: string[]
  first: ExclusiveJobPosting[]
  firstFitBuckets: Record<string, FitBucket>
  surface: string
}) {
  const [postings, setPostings] = useState(first)
  const [fitBuckets, setFitBuckets] = useState(firstFitBuckets)
  const [next, setNext] = useState(first.length)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const more = ids.slice(next, next + PAGE)

  function showMore() {
    setError(null)
    startTransition(async () => {
      const page = await loadMoreAtLevel(more).catch(() => null)
      if (!page) {
        setError('Could not load more jobs. Try again in a moment.')
        return
      }
      posthog.capture('more_at_level_loaded', { surface, shown: postings.length + page.postings.length, total, page: Math.ceil(next / PAGE) + 1 })
      setPostings((p) => [...p, ...page.postings])
      setFitBuckets((f) => ({ ...f, ...page.fitBuckets }))
      setNext(next + more.length)
    })
  }

  if (total === 0 || postings.length === 0) return null
  return (
    <section aria-labelledby="more-at-level-heading" className="space-y-2">
      <div>
        <h3 id="more-at-level-heading" className="text-sm font-semibold text-foreground">
          More jobs at your level <span className="font-normal text-muted-foreground">({total.toLocaleString()})</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Outside your field, pivots and skills matches, but at your level. Best fit first.
        </p>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {postings.map((p) => (
          <DiscoverJobCard key={p.id} posting={p} fitBucket={fitBuckets[p.id] ?? 'stretch'} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {more.length > 0 && (
          <Button variant="outline" size="sm" onClick={showMore} disabled={pending} aria-busy={pending} className={cn(pending && 'cursor-wait')}>
            {pending ? 'Loading…' : `Show ${more.length} more`}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Showing {postings.length.toLocaleString()} of {total.toLocaleString()}
          {total > ids.length && ` (the best ${ids.length.toLocaleString()} can be loaded here; search or filter to see others)`}
        </span>
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
    </section>
  )
}
