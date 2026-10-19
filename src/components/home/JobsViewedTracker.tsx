'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

/** Fires one event when the results page shows. Renders nothing. */
export function JobsViewedTracker({ q, loc, remote, total, shown }: { q: string; loc: string; remote: boolean; total: number; shown: number }) {
  useEffect(() => {
    posthog.capture('jobs_page_viewed', { q, loc, remote, total, shown })
  }, [q, loc, remote, total, shown])
  return null
}
