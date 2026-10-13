'use client'

import Link from 'next/link'
import { usePostHog } from '@/lib/posthog/client'
import { ArrowRight } from 'lucide-react'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { JOURNEY_CARDS } from '@/components/onboarding/journey-cards'

// The same eight journey cards as onboarding (journey-cards.ts).
const SITUATIONS = JOURNEY_CARDS

export function SituationalButtons() {
  const posthog = usePostHog()

  return (
    <div>
      <h3 className="text-center text-xl font-semibold text-navy">
        Which one sounds like you?
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
        Pick one and start now — we&apos;ll skip straight to what matters for your situation.
      </p>
      <div className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SITUATIONS.map(({ situation, icon: Icon, label, description }) => (
          <Link
            key={situation}
            href="/onboarding/desire"
            onClick={() => {
              posthog?.capture('situational_entry_selected', { situation, destination: 'onboarding' })
              window.gtag?.('event', 'situational_entry_selected', { situation, destination: 'onboarding' })
              sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
            }}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-light-gray bg-white p-5 text-center transition-colors hover:border-brand hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-navy group-hover:text-brand">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </div>
  )
}
