'use client'

import Link from 'next/link'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { getPersona } from '@/lib/constants/personas'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { adsEvent } from '@/lib/analytics/ads-events'

/**
 * The one button on a landing page. Stores the visitor's situation first (the same hand-off LaidOffStart and the /start
 * pages use) so onboarding's first question is already answered, then opens the Market Reality Assessment. plan_started
 * goes to PostHog and to GA4, where the ad account imports it as the conversion.
 */
export function LandingCta({ label, persona, page, variant, placement }: { label: string; persona: string; page: string; variant: string; placement: string }) {
  return (
    <Link
      href={MARKET_REALITY_START_HREF}
      onClick={() => {
        const situation = getPersona(persona)?.situation
        try {
          if (situation) sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
        } catch {
          // Private windows can block storage; onboarding simply asks.
        }
        adsEvent('plan_started', { page, variant, placement, cta: label })
      }}
      className="inline-flex h-12 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 active:cursor-wait"
    >
      {label}
    </Link>
  )
}
