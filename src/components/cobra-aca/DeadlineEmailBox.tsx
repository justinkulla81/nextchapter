'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { saveDeadlineReminders, type DeadlineSignupState } from '@/lib/tools/deadline-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'

/**
 * "Email me my deadlines" on the COBRA vs ACA pages. It saves the same reminder signup as /tools/layoff-deadlines (a HomepageLead of kind
 * deadline_reminders, confirmed by email before anything is sent, and only when DEADLINE_REMINDER_EMAILS=1), tagged with the page it came
 * from. After it is saved, one tap on a situation sets up the free profile. When the page already knows the last day (the tool), it is passed in.
 */
export function DeadlineEmailBox({
  source,
  state = '',
  lastDay,
  journeyChoices,
}: {
  source: 'cobra_vs_aca:tool' | 'cobra_vs_aca:explainer' | 'cobra_vs_aca:state'
  state?: string
  /** YYYY-MM-DD, when the page has already asked for it. */
  lastDay?: string
  journeyChoices: { slug: string; label: string }[]
}) {
  const [signup, action, pending] = useActionState<DeadlineSignupState, FormData>(saveDeadlineReminders, {})

  if (signup.saved) {
    return (
      <div role="status" className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm text-muted-foreground">
          {signup.confirmEmailed ? (
            <>Check your inbox{signup.email ? <> at <span className="font-medium text-foreground">{signup.email}</span></> : ''} and click the link to start your reminders.</>
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
                  onClick={() => posthog.capture('cobra_vs_aca_journey_chosen', { source, situation: c.slug })}
                  className={i === 0 ? 'rounded-full bg-action px-5 py-3 text-center font-semibold text-action-foreground hover:brightness-95' : 'rounded-full border border-border bg-white px-5 py-3 text-center font-medium text-foreground hover:bg-off-white'}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('rounded-xl border border-border bg-white p-5', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('cobra_vs_aca_email_submitted_client', { source, state })}
    >
      <p className="text-base font-semibold text-navy">Email me my deadlines</p>
      <p className="mt-1 text-sm text-muted-foreground">One email as each health coverage date comes up over the next two months, then nothing. No account needed.</p>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="state" value={state} />
      {lastDay && <input type="hidden" name="lastDay" value={lastDay} />}
      <div className="hidden" aria-hidden>
        <label htmlFor={`cobra-website-${source}`}>Website</label>
        <input id={`cobra-website-${source}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {!lastDay && (
        <label className="mt-3 block text-sm font-medium text-navy">
          Your last day of work
          <input type="date" name="lastDay" className={FIELD} />
        </label>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`cobra-email-${source}`}>Email address</label>
        <input id={`cobra-email-${source}`} name="email" type="email" inputMode="email" autoComplete="email" defaultValue={signup.email} placeholder="you@example.com" className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base" />
        <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Saving…' : 'Email me my deadlines'}
        </Button>
      </div>
      {signup.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {signup.error}
        </p>
      )}
    </form>
  )
}
