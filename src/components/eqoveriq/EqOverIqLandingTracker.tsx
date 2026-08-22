'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

// Mirrors CrucibleLandingTracker — fired client-side so this lands under
// PostHog's own real anonymous distinct_id, the one that later merges into
// a real identity if this visitor ever converts.
export function EqOverIqLandingTracker() {
  const posthog = usePostHog()
  useEffect(() => {
    posthog?.capture('eqoveriq_landing_view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
