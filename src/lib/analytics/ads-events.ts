'use client'

import { posthog } from '@/lib/posthog/client'

type Params = Record<string, string | number | boolean | undefined>

/**
 * An event that both PostHog and Google Analytics 4 should see. The ad campaigns import their conversions from GA4
 * (Google Ads > Goals > Conversions > Import from Google Analytics), so any event Google Ads should count as a
 * conversion goes through here; everything else stays PostHog-only via posthog.capture().
 *
 * gtag() is defined by GoogleAnalytics.tsx as soon as the page is interactive and queues calls until gtag.js loads, so
 * an event fired on the first click is not lost. When GA is switched off (no measurement ID) gtag is undefined and the
 * call does nothing.
 */
export function adsEvent(name: string, params: Params = {}) {
  posthog.capture(name, params)
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, params)
  } catch {
    // Analytics must never break a click.
  }
}
