'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

/** Fires one landing_viewed per page load, with the version, so the test can be read per person in PostHog. */
export function LandingTracker({ page, variant }: { page: string; variant: string }) {
  useEffect(() => {
    posthog.capture('landing_viewed', { page, variant })
  }, [page, variant])
  return null
}
