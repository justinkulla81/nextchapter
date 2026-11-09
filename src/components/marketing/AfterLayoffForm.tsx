'use client'

import { Suspense, useActionState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { submitJourneyLead, type JourneyState } from '@/lib/leads/actions'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { getPersona } from '@/lib/constants/personas'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const SITUATION = 'laid-off'

// The owner shares this page on LinkedIn, so a lead with no tag is "after-a-layoff:li" (owner decision, 2026-11-09). A link with ?utm_source=<tag> keeps that tag instead.
function sourceFrom(utm: string | null): string {
  const tag = (utm ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60)
  return `after-a-layoff:${tag || 'li'}`
}

function Form({ className }: { className?: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const source = sourceFrom(params.get('utm_source'))
  const [state, action, pending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)

  useEffect(() => {
    posthog.capture('after_a_layoff_viewed', { source, utmSource: params.get('utm_source'), utmCampaign: params.get('utm_campaign') })
  }, [source, params])

  // Straight into registration: no second question. The situation is stored so the first onboarding question is already answered,
  // and the lead cookie set by the action prefills their email on the details step.
  useEffect(() => {
    if (!state?.done) return
    try {
      sessionStorage.setItem(SITUATION_SESSION_KEY, getPersona(SITUATION)?.situation ?? 'just_laid_off')
    } catch {
      // Private windows can block storage; onboarding simply asks.
    }
    // The source rides along so the registration page can record the arrival (src/app/onboarding/desire/page.tsx).
    router.replace(`${MARKET_REALITY_START_HREF}&from=${encodeURIComponent(source)}`)
  }, [state, source, router])

  if (state?.done) {
    return (
      <p role="status" className="max-w-xl rounded-2xl bg-white p-5 text-base font-semibold text-ink">
        Got it. Setting up your account…
      </p>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('flex flex-col gap-3 sm:flex-row', className, pending && 'cursor-wait')}
    >
      <input type="hidden" name="situation" value={SITUATION} />
      <input type="hidden" name="source" value={source} />
      <div className="hidden" aria-hidden>
        <label htmlFor="fired-website">Website</label>
        <input id="fired-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="sr-only" htmlFor="fired-email">Email address</label>
      <input
        id="fired-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={state?.email}
        placeholder="you@example.com"
        aria-invalid={state?.error ? true : undefined}
        className="h-14 min-w-0 rounded-lg border border-border bg-white px-4 text-lg text-ink sm:flex-1"
      />
      <Button type="submit" size="lg" disabled={pending} className="h-14 shrink-0 rounded-full bg-action px-8 text-lg font-semibold text-action-foreground hover:bg-action hover:brightness-95">
        {pending ? 'Starting…' : 'Start my account'}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  )
}

export function AfterLayoffForm({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <Form className={className} />
    </Suspense>
  )
}
