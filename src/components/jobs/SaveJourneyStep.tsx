'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateAccountPrompt } from '@/components/jobs/CreateAccountPrompt'
import { PERSONAS } from '@/lib/constants/personas'
import { submitJourneyLead, type JourneyState } from '@/lib/leads/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The step after saving a job or a search without an account: one question (which situation sounds
// like you), which files the email as a journey lead and sends the first-week plan, then the account
// prompt. Skipping goes straight to the account prompt, so the question never blocks anything.
export function SaveJourneyStep({ email, what, properties }: { email: string; what: 'job' | 'search'; properties: Record<string, unknown> }) {
  const [skipped, setSkipped] = useState(false)
  const [situation, setSituation] = useState('')
  const [state, action, pending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)

  if (state?.done || skipped) {
    return (
      <>
        {state?.done && (
          <p role="status" className="mt-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
            {state.capped ? 'We saved your answer. Today’s plan emails are used up, so yours has not gone out.' : <>Your first-week plan is on its way to <span className="font-medium">{email}</span>. If it is not there in a few minutes, check spam.</>}
          </p>
        )}
        <CreateAccountPrompt what={what} properties={{ ...properties, journey: state?.slug ?? null, skippedJourney: !state?.done }} />
      </>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('mt-3 rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('save_journey_submitted_client', { ...properties, situation })}
    >
      <p className="text-sm font-semibold">One question: which sounds most like you?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Why we ask: a laid-off week and a thinking-about-a-move week look nothing alike. We email you a first-week plan for it.</p>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="source" value={`jobs:${what}`} />
      <div className="hidden" aria-hidden>
        <label htmlFor="journey-website">Website</label>
        <input id="journey-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="sr-only" htmlFor="save-situation">Your situation</label>
      <select
        id="save-situation"
        name="situation"
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        className="mt-3 h-11 w-full rounded-lg border border-border bg-white px-3 text-base"
      >
        <option value="">Choose one…</option>
        {PERSONAS.map((p) => (
          <option key={p.slug} value={p.slug}>{p.label}</option>
        ))}
      </select>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4">
        <Button type="submit" disabled={pending || !situation} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Sending…' : 'Email me my plan'}
        </Button>
        {!situation && <span className="text-xs text-muted-foreground">Choose one to continue.</span>}
        <button
          type="button"
          onClick={() => {
            posthog.capture('save_journey_skipped', properties)
            setSkipped(true)
          }}
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          Skip
        </button>
      </div>
    </form>
  )
}
