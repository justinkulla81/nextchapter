'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The job search box. It submits as a plain GET to /jobs, so the results live on their own
// page (with the "not personalized" directions) and nothing is fetched on the homepage.
// Used on the homepage and again at the top of the results page to refine a search.

export function JobSearchForm({
  source,
  initialQ = '',
  initialLoc = '',
  initialRemote = false,
}: {
  source: 'home' | 'results'
  initialQ?: string
  initialLoc?: string
  initialRemote?: boolean
}) {
  const [q, setQ] = useState(initialQ)
  const [loc, setLoc] = useState(initialLoc)
  const [remote, setRemote] = useState(initialRemote)
  const [submitting, setSubmitting] = useState(false)

  return (
    <form
      action="/jobs"
      method="get"
      role="search"
      className={cn('mx-auto w-full max-w-3xl', submitting && 'cursor-wait')}
      onSubmit={() => {
        setSubmitting(true)
        posthog.capture(source === 'home' ? 'home_board_searched' : 'jobs_page_searched', {
          q: q.trim(),
          loc: loc.trim(),
          remote,
        })
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`job-q-${source}`}>Job title or company</label>
        <input
          id={`job-q-${source}`}
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          placeholder="Job title or company"
          className="h-12 flex-1 rounded-lg border border-border bg-white px-4 text-base"
        />
        <label className="sr-only" htmlFor={`job-loc-${source}`}>City or state</label>
        <input
          id={`job-loc-${source}`}
          name="loc"
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          maxLength={100}
          placeholder="City or state"
          className="h-12 rounded-lg border border-border bg-white px-4 text-base sm:w-56"
        />
        {remote && <input type="hidden" name="remote" value="1" />}
        <Button
          type="submit"
          size="lg"
          className="h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95"
          disabled={submitting}
        >
          {submitting ? 'Searching…' : 'Search jobs'}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2" role="group" aria-label="Work location">
        <Button type="button" size="sm" variant={remote ? 'outline' : 'default'} aria-pressed={!remote} onClick={() => setRemote(false)}>
          Any location type
        </Button>
        <Button type="button" size="sm" variant={remote ? 'default' : 'outline'} aria-pressed={remote} onClick={() => setRemote(true)}>
          Remote only
        </Button>
      </div>
    </form>
  )
}
