'use client'

import Link from 'next/link'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { getPersona } from '@/lib/constants/personas'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { posthog } from '@/lib/posthog/client'

/** The Market Reality button on the COBRA vs ACA pages. Stores "laid off" first, the same hand-off the /start pages and the journey picker use, so onboarding's first question is answered. */
export function LaidOffStart({ placement, label = 'Get your free Market Reality Assessment' }: { placement: string; label?: string }) {
  return (
    <Link
      href={MARKET_REALITY_START_HREF}
      onClick={() => {
        const situation = getPersona('laid-off')?.situation
        try {
          if (situation) sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
        } catch {
          // Private windows can block storage; onboarding simply asks.
        }
        posthog.capture('cobra_vs_aca_cta_clicked', { placement, cta: 'market_reality' })
      }}
      className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
    >
      {label}
    </Link>
  )
}
