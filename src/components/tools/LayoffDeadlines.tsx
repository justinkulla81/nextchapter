'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { saveDeadlineReminders, type DeadlineSignupState } from '@/lib/tools/deadline-actions'
import { parseLastDay, plausibleLastDay, timeline, type TimelineRow } from '@/lib/tools/layoff-deadlines'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const day = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Enter the last day of work (and a state), see the dates that matter, and optionally get one email as each comes up.
// The timeline is worked out in the browser and stores nothing. The email box leads to the journey question.
export function LayoffDeadlines({ journeyChoices }: { journeyChoices: { slug: string; label: string }[] }) {
  const [lastDay, setLastDay] = useState('')
  const [state, setState] = useState('')
  const [rows, setRows] = useState<TimelineRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signup, signupAction, signing] = useActionState<DeadlineSignupState, FormData>(saveDeadlineReminders, {})

  function show(e: React.FormEvent) {
    e.preventDefault()
    const d = parseLastDay(lastDay)
    if (!d || !plausibleLastDay(d)) {
      setError('Enter your last day of work, within the last 60 days.')
      setRows(null)
      return
    }
    setError(null)
    setRows(timeline(d))
    posthog.capture('layoff_deadlines_run', { hasState: !!state })
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <form onSubmit={show} noValidate className="space-y-4 rounded-xl border border-border bg-white p-6">
        <label className="block text-sm font-medium text-navy">
          Your last day of work
          <input type="date" className={FIELD} value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-navy">
          Your state (optional)
          <select className={FIELD} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Choose a state</option>
            {ALL_STATE_CODES.map((c) => (
              <option key={c} value={c}>
                {stateName(c)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          Show my dates
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {rows && (
        <div role="status" className="space-y-4 rounded-xl border border-border bg-white p-6">
          <ol className="space-y-4">
            {rows.map((r) => (
              <li key={r.id} className={cn('border-l-4 pl-4', r.status === 'past' ? 'border-border' : 'border-action')}>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {day(r.date)}
                  {r.status === 'past' ? ' · already passed' : ''}
                </p>
                <p className="font-semibold text-navy">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.body}</p>
                {r.id === 'd2' && (
                  <p className="mt-1 text-sm">
                    <Link href={state ? `/unemployment-benefits/${stateSlug(state)}` : '/unemployment-benefits'} className="text-brand underline underline-offset-4">
                      {state ? `Unemployment benefits in ${stateName(state)}` : 'Unemployment benefits by state'}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Dates are counted from your last day and are a guide. COBRA and Marketplace windows run from when your coverage ends, and COBRA also from when your notice arrives, so confirm the exact date on your own paperwork or with your plan administrator. Unemployment rules differ by state.
          </p>

          {!signup.saved ? (
            <form action={signupAction} noValidate className={cn('border-t border-border pt-4', signing && 'cursor-wait')} onSubmit={() => posthog.capture('layoff_deadlines_email_submitted_client')}>
              <p className="text-sm font-semibold text-navy">Want an email as each date comes up?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">A few emails over the next two months, then nothing. No account needed.</p>
              <input type="hidden" name="lastDay" value={lastDay} />
              <input type="hidden" name="state" value={state} />
              <div className="hidden" aria-hidden>
                <label htmlFor="ld-website">Website</label>
                <input id="ld-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="ld-email">Email address</label>
                <input id="ld-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={signup.email} placeholder="you@example.com" className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base" />
                <Button type="submit" disabled={signing} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                  {signing ? 'Saving…' : 'Remind me'}
                </Button>
              </div>
              {signup.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {signup.error}
                </p>
              )}
            </form>
          ) : (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {signup.confirmEmailed ? (
                  <>Check your inbox{signup.email ? <> at <span className="font-medium text-foreground">{signup.email}</span></> : ''} and click the link to start the reminders.</>
                ) : (
                  <>Saved{signup.email ? <> for <span className="font-medium text-foreground">{signup.email}</span></> : ''}. Reminder emails are turning on soon.</>
                )}
              </p>
              {signup.token && (
                <>
                  <p className="mt-4 text-sm font-semibold text-navy">Which sounds most like you? One tap sets up your free profile.</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {journeyChoices.map((c, i) => (
                      <Link
                        key={c.slug}
                        href={`/api/job-alerts/journey/${encodeURIComponent(signup.token!)}?p=${c.slug}`}
                        className={i === 0 ? 'rounded-full bg-action px-5 py-3 text-center font-semibold text-action-foreground hover:brightness-95' : 'rounded-full border border-border bg-white px-5 py-3 text-center font-medium text-foreground hover:bg-off-white'}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
