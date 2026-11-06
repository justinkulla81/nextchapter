'use client'

import { posthog } from '@/lib/posthog/client'

type Params = Record<string, string | number | boolean | undefined>

// "AW-<account id>/<conversion label>" from the Google Ads conversion action (Goals > Conversions > the action > Tag setup).
// Unset: nothing extra is sent. Only a lead from an /lp/<offer> page counts (source "lp-<offer>"), not the general Contact form.
const ADS_LEAD_CONVERSION = process.env.NEXT_PUBLIC_ADS_LEAD_CONVERSION

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
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params)
      if (ADS_LEAD_CONVERSION && name === 'contact_form_sent' && String(params.source ?? '').startsWith('lp-')) {
        window.gtag('event', 'conversion', { send_to: ADS_LEAD_CONVERSION })
      }
    }
  } catch {
    // Analytics must never break a click.
  }
}
