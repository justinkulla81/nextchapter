'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { saveLayoffAlert, type LayoffAlertState } from '@/lib/leads/layoff-alert-actions'
import { posthog } from '@/lib/posthog/client'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { cn } from '@/lib/utils'

// "Email me when there is a new notice" at the foot of the layoff pages. One employer, one state, or the whole
// tracker. While the layoff emails are off the confirmation says so plainly; once on it asks for the confirm click.
export function LayoffAlertForm({ employer, employerName, state, stateLabel, source }: { employer?: string; employerName?: string; state?: string; stateLabel?: string; source: string }) {
  const [formState, action, pending] = useActionState<LayoffAlertState, FormData>(saveLayoffAlert, undefined)
  const picker = !employer && !state
  const what = employerName ?? stateLabel ?? 'the state you pick'

  if (formState?.saved) {
    return (
      <p role="status" className="rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
        {formState.confirmEmailed ? (
          <>Check your inbox{formState.email ? <> at <span className="font-medium">{formState.email}</span></> : ''} and click the link to start. If it is not there in a few minutes, check spam.</>
        ) : (
          <>Saved{formState.email ? <> for <span className="font-medium">{formState.email}</span></> : ''}. Layoff emails are turning on soon, and this will be first in line.</>
        )}
      </p>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('max-w-xl rounded-2xl border border-border bg-white p-5', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('layoff_alert_signup_submitted_client', { employer, state, source })}
    >
      <p className="text-base font-semibold text-navy">Get an email when a new notice is filed for {what}</p>
      <p className="mt-1 text-sm text-muted-foreground">One email a day at most, only when there is something new. No account needed.</p>
      <input type="hidden" name="employer" value={employer ?? ''} />
      {picker ? (
        <div className="mt-3">
          <label className="sr-only" htmlFor="layoff-state">State</label>
          <select id="layoff-state" name="state" defaultValue="" className="h-11 w-full rounded-lg border border-border bg-white px-3 text-base sm:w-64">
            <option value="" disabled>
              Choose a state
            </option>
            {ALL_STATE_CODES.map((c) => (
              <option key={c} value={c}>
                {stateName(c)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="state" value={state ?? ''} />
      )}
      <input type="hidden" name="source" value={source} />
      <div className="hidden" aria-hidden>
        <label htmlFor="layoff-website">Website</label>
        <input id="layoff-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="layoff-email">Email address</label>
        <input
          id="layoff-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={formState?.email}
          placeholder="you@example.com"
          aria-invalid={formState?.error ? true : undefined}
          className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base"
        />
        <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Saving…' : 'Email me'}
        </Button>
      </div>
      {formState?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {formState.error}
        </p>
      )}
    </form>
  )
}
