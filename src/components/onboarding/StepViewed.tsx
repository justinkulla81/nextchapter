'use client'

import { useEffect } from 'react'
import { usePostHog } from '@/lib/posthog/client'

// Fires once when an onboarding step is shown, with where the visitor came from, so the funnel can be cut by source and
// the people who saw a step can be compared with those who answered it (onboarding_bundle_completed). Never throws.
export function StepViewed({ step, flow = 'bundles' }: { step: string; flow?: string }) {
  const posthog = usePostHog()
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      let referrerHost: string | null = null
      try {
        referrerHost = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : null
      } catch {
        referrerHost = null
      }
      posthog?.capture('onboarding_step_viewed', {
        step,
        flow,
        path: window.location.pathname,
        referrerHost,
        utmSource: q.get('utm_source'),
        utmCampaign: q.get('utm_campaign'),
        from: q.get('from'),
        goal: q.get('goal'),
      })
    } catch {
      // Analytics must never break the page.
    }
    // One event per page view of the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  return null
}
