'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

const LAST_KEY = 'nc-board-search-tracked'

/**
 * Fires job_search_submitted (and job_search_no_results) once a search's results
 * have rendered, so the event carries the real result count. Once per distinct
 * search per tab: a reload of the same search doesn't count again.
 */
export function BoardSearchTracker(props: {
  q: string
  loc: string
  remote: string | null
  sort: string
  resultCount: number
  filtersActive: string[]
}) {
  const { q, loc, remote, sort, resultCount, filtersActive } = props
  const filters = filtersActive.join(',')
  useEffect(() => {
    const key = JSON.stringify([q, loc, remote, sort, filters])
    try {
      if (sessionStorage.getItem(LAST_KEY) === key) return
      sessionStorage.setItem(LAST_KEY, key)
    } catch {
      // No session storage (private mode): track every render instead.
    }
    posthog.capture('job_search_submitted', { q, loc, remote, sort, resultCount, filtersActive: filters ? filters.split(',') : [] })
    if (resultCount === 0) posthog.capture('job_search_no_results', { q, loc, remote, sort, filtersActive: filters ? filters.split(',') : [] })
  }, [q, loc, remote, sort, resultCount, filters])
  return null
}
