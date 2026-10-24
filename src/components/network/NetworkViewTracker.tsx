'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

/** Fires one event when a /network page shows. Renders nothing. */
export function NetworkViewTracker({ type, slug, state, jobsInState, jobsAtEmployer }: { type: string; slug: string; state: string; jobsInState: number; jobsAtEmployer: number }) {
  useEffect(() => {
    posthog.capture('network_page_viewed', { type, slug, state, jobsInState, jobsAtEmployer })
  }, [type, slug, state, jobsInState, jobsAtEmployer])
  return null
}
