'use client'

import { useState, useTransition } from 'react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DiscoverJobCard } from '@/components/dashboard/DiscoverJobCard'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import { loadMoreGoodMatches } from '@/app/dashboard/find-my-job/breadth-actions'

const PAGE = 20

/**
 * "Show more good matches": relevant jobs past the best ones the board shows, best fit
 * first, a page at a time — only when the member asks; never part of the default view.
 */
export function GoodMatchesMore({ ids, surface }: { ids: string[]; surface: string }) {
  const [postings, setPostings] = useState<ExclusiveJobPosting[]>([])
  const [fitBuckets, setFitBuckets] = useState<Record<string, FitBucket>>({})
  const [candidatePlus, setCandidatePlus] = useState(false)
  const [next, setNext] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const page = ids.slice(next, next + PAGE)
  if (ids.length === 0) return null

  function load() {
    setError(null)
    startTransition(async () => {
      const r = await loadMoreGoodMatches(page).catch(() => null)
      if (!r) {
        setError('Could not load more jobs. Try again in a moment.')
        return
      }
      posthog.capture('good_matches_more_loaded', { surface, page: next / PAGE + 1, shown: postings.length + r.postings.length, available: ids.length })
      setPostings((p) => [...p, ...r.postings])
      setFitBuckets((f) => ({ ...f, ...r.fitBuckets }))
      setCandidatePlus(r.candidatePlus)
      setNext(next + page.length)
    })
  }

  return (
    <section aria-label="More good matches" className="space-y-2">
      {postings.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border">
          {postings.map((p) => (
            <DiscoverJobCard key={p.id} posting={p} fitBucket={fitBuckets[p.id] ?? 'good'} candidatePlus={candidatePlus} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {page.length > 0 && (
          <Button variant="outline" size="sm" onClick={load} disabled={pending} aria-busy={pending} className={cn(pending && 'cursor-wait')}>
            {pending ? 'Loading…' : postings.length === 0 ? `Show more good matches (${ids.length.toLocaleString()})` : `Show ${page.length} more`}
          </Button>
        )}
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
    </section>
  )
}
