'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { submitJourneyLead, type JourneyState } from '@/lib/leads/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// "Make this guide yours" at the foot of an employer's layoff guide: the situation (three buttons, which sets the first-week plan
// email) and an email. The free account then asks for the state, line of work and anything that applies, and matches benefits,
// jobs and support to it. Files as a journey lead (src/lib/leads/actions.ts), so the plan email and its daily cap are the same.
const SITUATIONS = [
  { slug: 'laid-off', label: 'I was laid off' },
  { slug: 'thinking-about-a-move', label: 'I’m deciding on a buyout or leaving' },
  { slug: 'managing-my-career', label: 'I’m still here and planning ahead' },
] as const

export function GuideLeadForm({ slug, company, state }: { slug: string; company: string; state: string | null }) {
  const [situation, setSituation] = useState<string>('')
  const [formState, action, pending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)
  const props = { company: slug, state, situation }

  if (formState?.done) {
    return (
      <div role="status" className="rounded-2xl border border-success/30 bg-success/5 p-5 text-sm">
        <p>
          {formState.capped
            ? 'We saved your answer. Today’s plan emails are used up, so yours has not gone out.'
            : <>Your first-week plan is on its way to <span className="font-medium">{formState.email}</span>. If it is not there in a few minutes, check spam.</>}
        </p>
        <Link
          href="/onboarding/desire"
          onClick={() => posthog.capture('layoff_guide_account_cta_clicked', { ...props, situation: formState.slug ?? situation })}
          className="mt-3 inline-block rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-action-foreground hover:brightness-95"
        >
          Create a free account to match benefits and jobs
        </Link>
      </div>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('rounded-2xl border border-border bg-white p-5', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('layoff_guide_lead_submitted_client', props)}
    >
      <h3 className="text-lg font-semibold tracking-tight text-navy">Make this guide yours</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Tell us where you stand and we email a first-week plan. A free account then asks your state, line of work and what applies to you,
        and matches benefits, local support and jobs to it.
      </p>
      <input type="hidden" name="situation" value={situation} />
      <input type="hidden" name="source" value={`layoffs:guide:${slug}`} />
      <div className="hidden" aria-hidden>
        <label htmlFor="guide-website">Website</label>
        <input id="guide-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div role="group" aria-label={`Where you stand with ${company}`} className="mt-4 flex flex-wrap gap-2">
        {SITUATIONS.map((s) => (
          <button
            key={s.slug}
            type="button"
            aria-pressed={situation === s.slug}
            onClick={() => { setSituation(s.slug); posthog.capture('layoff_guide_situation_picked', { ...props, situation: s.slug }) }}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium',
              situation === s.slug ? 'border-brand bg-brand text-white' : 'border-border bg-white text-navy hover:border-brand',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="guide-email">Email address</label>
        <input id="guide-email" name="email" type="email" autoComplete="email" defaultValue={formState?.email ?? ''} placeholder="you@example.com" className="h-11 w-full rounded-lg border border-border bg-white px-3 text-base sm:w-72" />
        <Button type="submit" disabled={pending || !situation} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Sending…' : 'Email me my plan'}
        </Button>
        {!situation && <span className="text-xs text-muted-foreground">Pick where you stand to continue.</span>}
      </div>
      {formState?.error && <p role="alert" className="mt-2 text-sm text-destructive">{formState.error}</p>}
    </form>
  )
}
