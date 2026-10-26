'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PERSONAS } from '@/lib/constants/personas'
import { JOURNEY_GROUPS } from '@/lib/constants/journey-groups'
import { planFor } from '@/lib/leads/first-week-plans'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
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

// The answer they just gave goes with them into onboarding, whose first question then comes preselected: they confirm
// instead of answering again. (Same hand-off as the /start pages, via sessionStorage; a blocked store just means no preselect.)
function rememberSituation(slug: string | null | undefined) {
  const situation = PERSONAS.find((p) => p.slug === slug)?.situation
  if (!situation) return
  try {
    sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
  } catch {
    // Private windows can block storage.
  }
}

// `source` says which page the form sits on ('home', or 'network:<type>:<slug>'); `compact` skips the
// how-long question for pages that already know the person's context; `situations` limits the choices.
export function JourneyPicker({ source = 'home', compact = false, situations }: { source?: string; compact?: boolean; situations?: string[] }) {
  const [groupKey, setGroupKey] = useState<string | null>(null)
  const [situation, setSituation] = useState<string | null>(null)
  const [followup, setFollowup] = useState<string | null>(null)
  const [state, action, pending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)

  const persona = PERSONAS.find((p) => p.slug === situation)
  // Groups with at least one situation this page allows. A page that limits the choices to one group skips question 1.
  const groups = JOURNEY_GROUPS.map((g) => ({ ...g, slugs: g.slugs.filter((s) => !situations || situations.includes(s)) })).filter((g) => g.slugs.length > 0)
  const group = groups.find((g) => g.key === (groupKey ?? (groups.length === 1 ? groups[0].key : '')))
  const needsDuration = !compact && !!group?.asksDuration
  const step = state?.done ? 5 : !group ? 1 : !situation ? 2 : needsDuration && !followup ? 3 : 4
  const planPreview = situation ? planFor(situation) : null
  const chooseSituation = (slug: string) => {
    setSituation(slug)
    posthog.capture('journey_picker_situation_selected', { situation: slug, group: group?.key, source })
  }

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
          href={MARKET_REALITY_START_HREF}
          onClick={() => {
            rememberSituation(slug)
            posthog.capture('journey_picker_continue_clicked', { situation: slug })
          }}
          className="mt-5 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          {state.capped ? 'Get your Market Reality Assessment' : 'Or start now: get your Market Reality Assessment'}
        </Link>
      </div>
    )
  }

  const back = () => {
    if (step === 4 && needsDuration) setFollowup(null)
    else if (step === 4 && group && group.slugs.length > 1) setSituation(null)
    else if (step === 4 || step === 2) {
      setSituation(null)
      setGroupKey(null)
    } else if (step === 3) setSituation(null)
  }

  return (
    <div className={cn('mx-auto w-full max-w-3xl', pending && 'cursor-wait')}>
      {step < 4 && <p className="text-center text-sm font-semibold tracking-widest text-muted-foreground uppercase">Question {step}</p>}

      {step === 1 && (
        <>
          <h3 className="mt-2 text-center font-display text-2xl font-semibold text-ink text-balance">Where are you right now?</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Why we ask: a laid-off week and a thinking-about-a-move week look nothing alike. No résumé, no account.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => {
                    setGroupKey(g.key)
                    posthog.capture('journey_picker_group_selected', { group: g.key, source })
                    // One situation in the group: nothing left to ask, go straight on.
                    if (g.slugs.length === 1) chooseSituation(g.slugs[0])
                  }}
                  className="h-full w-full rounded-xl border border-border bg-white px-4 py-3 text-left hover:bg-muted"
                >
                  <span className="block text-base font-semibold text-ink">{g.label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{g.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 2 && group && (
        <>
          <h3 className="mt-2 text-center font-display text-2xl font-semibold text-ink text-balance">{group.question}</h3>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {group.slugs.map((slug) => {
              const p = PERSONAS.find((x) => x.slug === slug)
              return p ? (
                <li key={slug}>
                  <button
                    type="button"
                    onClick={() => chooseSituation(slug)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-left text-base font-semibold text-ink hover:bg-muted"
                  >
                    {p.label}
                  </button>
                </li>
              ) : null
            })}
          </ul>
          {groups.length > 1 && (
            <p className="mt-3 text-center">
              <button type="button" onClick={back} className="text-sm text-muted-foreground underline underline-offset-4">
                Back
              </button>
            </p>
          )}
        </>
      )}

      {step === 3 && (
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
            <button type="button" onClick={back} className="text-sm text-muted-foreground underline underline-offset-4">
              Change my answer
            </button>
          </p>
        </>
      )}

      {step === 4 && planPreview && (
        <>
          <h3 className="mt-2 text-center font-display text-2xl font-semibold text-ink text-balance">Your first week: {persona?.label}</h3>
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-border bg-white p-4 text-left">
            <p className="text-sm text-muted-foreground">{planPreview.intro}</p>
            <p className="mt-3 text-sm font-semibold tracking-widest text-muted-foreground uppercase">Step 1</p>
            <p className="mt-1 text-base text-ink">{planPreview.steps[0]}</p>
            <p className="mt-3 text-sm text-muted-foreground">We’ll email you the other {planPreview.steps.length - 1}.</p>
          </div>
          <form
            action={action}
            noValidate
            className="mx-auto mt-5 flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={() => posthog.capture('journey_picker_submitted', { situation, followup, source })}
          >
            <input type="hidden" name="situation" value={situation ?? ''} />
            <input type="hidden" name="followup" value={followup ?? ''} />
            <input type="hidden" name="source" value={source} />
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
              {pending ? 'Sending…' : 'Email me the rest'}
            </Button>
          </form>
          <p className="mt-2 text-center text-sm text-muted-foreground">One plan, and nothing else unless you ask.</p>
          <p className="mt-1 text-center text-sm">
            <Link
              href={MARKET_REALITY_START_HREF}
              onClick={() => {
                rememberSituation(situation)
                posthog.capture('journey_picker_skip_to_assessment_clicked', { situation, source })
              }}
              className="text-muted-foreground underline underline-offset-4"
            >
              Skip the email: start my Market Reality Assessment
            </Link>
          </p>
          {state?.error && (
            <p role="alert" className="mt-3 text-center text-sm text-destructive">
              {state.error}
            </p>
          )}
          <p className="mt-3 text-center">
            <button type="button" onClick={back} className="text-sm text-muted-foreground underline underline-offset-4">
              Back
            </button>
          </p>
        </>
      )}
    </div>
  )
}
