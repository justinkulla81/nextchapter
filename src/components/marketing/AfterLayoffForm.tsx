'use client'

import { Suspense, useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { submitJourneyLead, type JourneyState } from '@/lib/leads/actions'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const SITUATION = 'laid-off'

// The link someone was given carries ?utm_source=<who>; it is saved on the lead as source "after-a-layoff:<who>".
function sourceFrom(utm: string | null): string {
  const tag = (utm ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60)
  return tag ? `after-a-layoff:${tag}` : 'after-a-layoff'
}

function Form() {
  const params = useSearchParams()
  const source = sourceFrom(params.get('utm_source'))
  const [state, action, pending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)

  useEffect(() => {
    posthog.capture('after_a_layoff_viewed', { source, utmSource: params.get('utm_source'), utmCampaign: params.get('utm_campaign') })
  }, [source, params])

  if (state?.done) {
    return (
      <div role="status" className="mx-auto max-w-xl rounded-2xl border border-border bg-white p-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-ink">{state.capped ? 'We saved your email.' : 'Check your inbox.'}</h2>
        <p className="mt-2 text-base text-muted-foreground">
          {state.capped
            ? 'We send a limited number of plan emails each day and today’s are used up, so yours has not gone out. Start now and your plan is ready in minutes.'
            : <>Your first-week plan is on its way{state.email ? <> to <span className="font-medium text-ink">{state.email}</span></> : ''}. If it is not there in a few minutes, check spam.</>}
        </p>
        <Link
          href={MARKET_REALITY_START_HREF}
          onClick={() => {
            try {
              sessionStorage.setItem(SITUATION_SESSION_KEY, SITUATION)
            } catch {
              // Private windows can block storage.
            }
            posthog.capture('after_a_layoff_continue_clicked', { source, email_sent: !state.capped })
          }}
          className="mt-5 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          Start my Market Reality Assessment
        </Link>
      </div>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('mx-auto flex max-w-md flex-col gap-3 sm:flex-row', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('after_a_layoff_submitted', { source })}
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
        className="h-12 shrink-0 rounded-lg border border-border bg-white px-4 text-base sm:flex-1"
      />
      <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-full bg-action px-6 text-action-foreground hover:bg-action hover:brightness-95">
        {pending ? 'Sending…' : 'Email me my plan'}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  )
}

export function AfterLayoffForm() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  )
}
