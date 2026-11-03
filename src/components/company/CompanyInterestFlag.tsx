'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { flagCompanyInterest, type CompanyInterestState } from '@/lib/leads/company-interest-actions'
import { posthog } from '@/lib/posthog/client'
import { getFollowState } from '@/lib/company-tracker/follow-state-action'
import { setCompanyWatched } from '@/app/dashboard/find-my-job/my-jobs-actions'
import { cn } from '@/lib/utils'

// Where the flag sends a person once the company is saved: the start of registration (same door as a saved job or search).
export const COMPANY_INTEREST_ACCOUNT_HREF = '/onboarding/desire?from=company_interest'

/**
 * "I'm interested in <company>" on every company page. One button opens an email field (required); saving stores the
 * company against the email and the one next step is creating the free account, which then follows the company.
 */
export function CompanyInterestFlag({ company, slug, page }: { company: string; slug: string; page: 'employer' | 'layoffs' | 'network' }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<CompanyInterestState, FormData>(flagCompanyInterest, undefined)
  const properties = { companyName: company, slug, page }
  // The pages are cached for everyone. A signed-in member already has an email and an account, so for them the flag is one click that follows the company.
  const [member, setMember] = useState<{ signedIn: boolean; following: boolean } | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [memberPending, startMember] = useTransition()
  useEffect(() => {
    let live = true
    getFollowState(company).then((s) => live && setMember(s))
    return () => {
      live = false
    }
  }, [company])

  if (member?.signedIn) {
    return (
      <div className={cn('rounded-2xl border border-border bg-white p-4 text-navy', memberPending && 'cursor-wait')}>
        {member.following ? (
          <p role="status" className="text-sm font-semibold">You follow {company}. It is on your list of followed companies.</p>
        ) : (
          <>
            <Button
              type="button"
              disabled={memberPending}
              onClick={() => {
                setMemberError(null)
                posthog.capture('company_interest_member_clicked', properties)
                startMember(async () => {
                  const r = await setCompanyWatched(company, true)
                  if (r.ok) setMember({ signedIn: true, following: true })
                  else setMemberError(r.error)
                })
              }}
              className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95"
            >
              {memberPending ? 'Saving…' : `I'm interested in ${company}`}
            </Button>
            {memberError && <p role="alert" className="mt-2 text-sm text-destructive">{memberError}</p>}
          </>
        )}
      </div>
    )
  }

  if (state?.saved) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4 text-navy">
        <p role="status" className="text-sm font-semibold">
          Saved: {company}{state.email ? <> is on file for <span className="font-medium">{state.email}</span></> : ''}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Create your free account with the same email and {company} is on your followed companies, with its openings and what we know about it.</p>
        <TrackedLink
          href={COMPANY_INTEREST_ACCOUNT_HREF}
          event="company_interest_create_account_clicked"
          properties={properties}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-3 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95 sm:w-auto sm:px-6')}
        >
          Create my free account
        </TrackedLink>
      </div>
    )
  }

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => {
          posthog.capture('company_interest_opened', properties)
          setOpen(true)
        }}
        className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95"
      >
        I&apos;m interested in {company}
      </Button>
    )
  }

  return (
    <form
      action={action}
      noValidate
      className={cn('rounded-2xl border border-border bg-white p-4 text-navy', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('company_interest_submitted_client', properties)}
    >
      <p className="text-sm font-semibold">Save {company} and start your free account</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Your email is required so the company is kept for you. We use it to set up your account.</p>
      <input type="hidden" name="company" value={company} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="page" value={page} />
      <div className="hidden" aria-hidden>
        <label htmlFor="interest-website">Website</label>
        <input id="interest-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="interest-email">Email address</label>
        <input
          id="interest-email"
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
          {pending ? 'Saving…' : `Save ${company}`}
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
