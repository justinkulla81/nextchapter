'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

// Fired client-side (not a server component capture with a synthesized
// identity) so this event lands under PostHog's own real anonymous
// distinct_id — the one that later merges into a real identity if this
// visitor ever converts, which is what makes the landing→start funnel
// (§8) actually work.
export function CrucibleLandingTracker({ src }: { src: string }) {
  const posthog = usePostHog()
  useEffect(() => {
    posthog?.capture('crucible_landing_view', { src })
    // Only ever fires once per real page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
