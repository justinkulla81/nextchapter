'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import type { FirstWeekStep } from '@/lib/onboarding/first-week'

// Day-by-day first-week step, shown as the day's note for a member's first
// seven days. Optional: "Not now" hides it for the day.
export function FirstWeekCard({ step }: { step: FirstWeekStep }) {
  const posthog = usePostHog()
  const key = `nc-first-week-${step.day}`
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <section aria-labelledby="first-week" className="space-y-3 rounded-xl border border-border bg-white p-6">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Day {step.day} of 7 · about {step.minutes} minutes</p>
      <h2 id="first-week" className="text-lg font-semibold">
        {step.title}
      </h2>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Why it matters:</span> {step.why}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={step.href}
          onClick={() => posthog?.capture('first_week_step_started', { day: step.day, href: step.href })}
          className="rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-navy hover:opacity-90"
        >
          {step.cta}
        </Link>
        <button
          type="button"
          onClick={() => {
            posthog?.capture('first_week_step_skipped', { day: step.day })
            try {
              localStorage.setItem(key, '1')
            } catch {
              /* storage blocked */
            }
            setHidden(true)
          }}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </section>
  )
}
