'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PERSONAS } from '@/lib/constants/personas'
import { submitJourneyLead, type JourneyState } from '@/lib/leads/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// "Where are you in your search?" Three short steps and no résumé: pick your situation, say how
// long it has been going on, and get a first-week plan by email. The same situations as the
// /start pages. Why we ask comes first on every step, per the redesign's question-flow rule.

const FOLLOWUPS = [
  { value: 'just_starting', label: 'Just started thinking about it' },
  { value: 'weeks', label: 'A few weeks' },
  { value: 'months', label: 'A few months' },
  { value: 'long', label: 'Six months or more' },
]

export function JourneyPicker() {
  const [situation, setSituation] = useState<string | null>(null)
  const [followup, setFollowup] = useState<string | null>(null)
  const [state, action, pending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)

  const persona = PERSONAS.find((p) => p.slug === situation)
  const step = state?.done ? 4 : !situation ? 1 : !followup ? 2 : 3

  if (state?.done) {
    const slug = state.slug ?? situation ?? ''
    return (
      <div role="status" className="mx-auto max-w-xl rounded-2xl border border-border bg-white p-6 text-center">
        <h3 className="font-display text-2xl font-semibold text-ink">{state.capped ? 'We saved your answers.' : 'Check your inbox.'}</h3>
        <p className="mt-2 text-base text-muted-foreground">
          {state.capped ? (
            <>We send a limited number of plan emails each day and today&apos;s are used up, so yours has not gone out. Start now and your plan is ready in minutes.</>
          ) : (
            <>Your first-week plan is on its way{state.email ? <> to <span className="font-medium text-ink">{state.email}</span></> : ''}. If it is not there in a few minutes, check spam.</>
          )}
        </p>
        <Link
          href={`/start/${slug}`}
          onClick={() => posthog.capture('journey_picker_continue_clicked', { situation: slug })}
          className="mt-5 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          {state.capped ? 'Get your Market Reality Assessment' : 'Or start now: get your Market Reality Assessment'}
        </Link>
      </div>
    )
  }

  return (
    <div className={cn('mx-auto w-full max-w-3xl', pending && 'cursor-wait')}>
      <p className="text-center text-sm font-semibold tracking-widest text-muted-foreground uppercase">Question {step} of 3</p>

      {step === 1 && (
        <>
          <h3 className="mt-2 text-center font-display text-2xl font-semibold text-ink text-balance">Which sounds most like you?</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Why we ask: a laid-off week and a thinking-about-a-move week look nothing alike. No résumé, no account.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setSituation(p.slug)
                    posthog.capture('journey_picker_situation_selected', { situation: p.slug })
                  }}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-left text-base font-semibold text-ink hover:bg-muted"
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 2 && (
        <>
          <h3 className="mt-2 text-center font-display text-2xl font-semibold text-ink text-balance">How long has this been going on?</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Why we ask: the right first step is different in week one and in month six.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {FOLLOWUPS.map((f) => (
              <Button
                key={f.value}
                type="button"
                variant="outline"
                size="lg"
                className="h-12 justify-center rounded-xl text-base"
                onClick={() => {
                  setFollowup(f.value)
                  posthog.capture('journey_picker_followup_selected', { situation, followup: f.value })
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-center">
            <button type="button" onClick={() => setSituation(null)} className="text-sm text-muted-foreground underline underline-offset-4">
              Change my answer
            </button>
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <h3 className="mt-2 text-center font-display text-2xl font-semibold text-ink text-balance">Where should we send your first-week plan?</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            You picked <span className="font-medium text-ink">{persona?.label}</span>. We send one plan, and nothing else unless you ask.
          </p>
          <form
            action={action}
            noValidate
            className="mx-auto mt-5 flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={() => posthog.capture('journey_picker_submitted', { situation, followup })}
          >
            <input type="hidden" name="situation" value={situation ?? ''} />
            <input type="hidden" name="followup" value={followup ?? ''} />
            <div className="hidden" aria-hidden>
              <label htmlFor="journey-website">Website</label>
              <input id="journey-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <label className="sr-only" htmlFor="journey-email">Email address</label>
            <input
              id="journey-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state?.email}
              placeholder="you@example.com"
              aria-invalid={state?.error ? true : undefined}
              className="h-12 flex-1 rounded-lg border border-border bg-white px-4 text-base"
            />
            <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
              {pending ? 'Sending…' : 'Send me my plan'}
            </Button>
          </form>
          {state?.error && (
            <p role="alert" className="mt-3 text-center text-sm text-destructive">
              {state.error}
            </p>
          )}
          <p className="mt-3 text-center">
            <button type="button" onClick={() => setFollowup(null)} className="text-sm text-muted-foreground underline underline-offset-4">
              Back
            </button>
          </p>
        </>
      )}
    </div>
  )
}
