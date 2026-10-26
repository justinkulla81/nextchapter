'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { saveJobSearchAlert, type SavedSearchState } from '@/lib/leads/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { SaveJourneyStep } from '@/components/jobs/SaveJourneyStep'

// "Email me new jobs like this" on the results page. It saves the search with the email. While the alert
// emails are off the confirmation says so plainly; once they are on it asks for the confirm click.
export function SaveSearchForm({
  q,
  loc,
  remote,
  source,
  heading = 'Email me new jobs like this',
  blurb = 'We save this search and tell you when new matches are ready. No account needed.',
  cta = 'Save this search',
}: {
  q: string
  loc: string
  remote: boolean
  /** The page type whose box this is: 'page:employer' | 'page:title' | 'page:salary' | 'page:place'. Search results leave it out. */
  source?: string
  heading?: string
  blurb?: string
  cta?: string
}) {
  const [state, action, pending] = useActionState<SavedSearchState, FormData>(saveJobSearchAlert, undefined)

  if (state?.saved) {
    return (
      <div>
      <p role="status" className="rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
        {state.confirmEmailed ? (
          <>Check your inbox{state.email ? <> at <span className="font-medium">{state.email}</span></> : ''} and click the link to start. If it is not there in a few minutes, check spam.</>
        ) : (
          <>Saved{state.email ? <> for <span className="font-medium">{state.email}</span></> : ''}. New-job emails are turning on soon, and this search will be first in line.</>
        )}
      </p>
      <SaveJourneyStep email={state.email ?? ''} what="search" properties={{ placement: 'search_saved', q, loc, remote }} />
      </div>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('job_alert_signup_submitted_client', { q, loc, remote, source: source ?? 'jobs' })}
    >
      <p className="text-sm font-semibold">{heading}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
      {source && <input type="hidden" name="source" value={source} />}
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="loc" value={loc} />
      <input type="hidden" name="remote" value={remote ? '1' : ''} />
      <div className="hidden" aria-hidden>
        <label htmlFor="alert-website">Website</label>
        <input id="alert-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="alert-email">Email address</label>
        <input
          id="alert-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state?.email}
          placeholder="you@example.com"
          aria-invalid={state?.error ? true : undefined}
          className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base"
        />
        <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Saving…' : cta}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
