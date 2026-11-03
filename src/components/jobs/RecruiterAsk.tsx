'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { saveRecruiterInterest, type RecruiterInterestState } from '@/lib/leads/recruiter-interest-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export const RECRUITER_INTEREST_ACCOUNT_HREF = '/onboarding/desire?from=recruiter_interest'

/**
 * Shown on a senior job page (src/lib/jobs/recruiter-ask.ts decides). A yes/no question first, as two adjacent buttons; yes opens one
 * email field. Saving sends the person to create the free account, which is the profile recruiters see.
 */
export function RecruiterAsk({ jobId, company, space }: { jobId: string; company: string; space: string }) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)
  const [state, action, pending] = useActionState<RecruiterInterestState, FormData>(saveRecruiterInterest, undefined)
  const properties = { jobId, company, space }

  useEffect(() => {
    posthog.capture('recruiter_ask_shown', properties)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  function choose(a: 'yes' | 'no') {
    setAnswer(a)
    posthog.capture('recruiter_ask_answered', { ...properties, answer: a })
  }

  if (answer === 'no') return null

  if (state?.saved) {
    return (
      <section aria-label="Recruiters" className="mt-6 rounded-2xl border border-border bg-white p-4 text-navy">
        <p role="status" className="text-sm font-semibold">
          Saved{state.email ? <> for <span className="font-medium">{state.email}</span></> : ''}: you are open to recruiters in {space}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Create your free account with the same email. Your profile is what recruiters see.</p>
        <TrackedLink
          href={RECRUITER_INTEREST_ACCOUNT_HREF}
          event="recruiter_interest_create_account_clicked"
          properties={properties}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-3 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95 sm:w-auto sm:px-6')}
        >
          Join free
        </TrackedLink>
      </section>
    )
  }

  return (
    <section aria-label="Recruiters" className={cn('mt-6 rounded-2xl border border-border bg-white p-4 text-navy', pending && 'cursor-wait')}>
      <p className="text-sm font-semibold">Want recruiters in {space} to be able to find you?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Roles at this level, like this one at {company}, are often filled through recruiters.</p>
      {answer !== 'yes' ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={() => choose('yes')} className="h-11 rounded-full px-5">
            Yes, I want that
          </Button>
          <Button type="button" variant="outline" onClick={() => choose('no')} className="h-11 rounded-full px-5">
            No thanks
          </Button>
        </div>
      ) : (
        <form action={action} noValidate onSubmit={() => posthog.capture('recruiter_interest_submitted_client', properties)}>
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="company" value={company} />
          <input type="hidden" name="space" value={space} />
          <div className="hidden" aria-hidden>
            <label htmlFor="recruiter-website">Website</label>
            <input id="recruiter-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="recruiter-email">Email address</label>
            <input
              id="recruiter-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              defaultValue={state?.email}
              placeholder="you@example.com"
              aria-invalid={state?.error ? true : undefined}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-base text-navy sm:flex-1"
            />
            <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
              {pending ? 'Saving…' : 'Save my interest'}
            </Button>
          </div>
          {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
        </form>
      )}
    </section>
  )
}
