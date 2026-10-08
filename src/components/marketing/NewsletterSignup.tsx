'use client'

import { useActionState } from 'react'
import { subscribeToNewsletter, type NewsletterState } from '@/lib/newsletter/actions'

type NewsletterSource =
  | 'home' | 'how-it-works' | 'why-stuck' | 'news' | 'resources'
  | 'displacement-report' | 'displacement-report-popup' | 'displacement-report-pdf' | 'site-footer'

type Variant = 'default' | 'report' | 'compact' | 'inline'

const COPY: Record<'default' | 'report', { heading: string; body: string; cta: string }> = {
  default: {
    heading: 'The job market, once a week',
    body:
      "One email every Tuesday with the week's most useful read on the job market and the search, plus occasional news from NextChapter. No account needed. Unsubscribe any time.",
    cta: 'Get the weekly email',
  },
  report: {
    heading: 'The Displacement Report, monthly, plus the weekly job-market email',
    body:
      'New data on white-collar job loss and the White-Collar Long-Term Unemployment Index, the week the jobs report comes out — plus the Tuesday email on the search. Free, no account, unsubscribe any time.',
    cta: 'Get the report monthly',
  },
}

/**
 * The weekly-email signup: one field, no account. One list for the whole site;
 * `source` records which box was used and `variant` sets the copy and layout.
 *
 * - default / report: the full centered box (report copy names the monthly report)
 * - compact: a single-line version for the dark site footer
 */
export function NewsletterSignup({
  source,
  variant = 'default',
}: {
  source: NewsletterSource
  variant?: Variant
}) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeToNewsletter, undefined)
  const id = `newsletter-${source}`

  // Hidden-from-people honeypot: a filled value is a bot, answered as success, stored as nothing.
  const honeypot = (
    <div className="hidden" aria-hidden>
      <label htmlFor={`${id}-website`}>Website</label>
      <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  )

  if (variant === 'inline') {
    return (
      <div className="w-full">
        {state?.subscribed ? (
          <p role="status" className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-navy">
            You&apos;re on the list{state.email ? <> at <span className="font-medium">{state.email}</span></> : ''}. The next edition lands the week the jobs report comes out.
          </p>
        ) : (
          <form action={action} noValidate className={`flex w-full max-w-md flex-col gap-2 sm:flex-row ${pending ? 'cursor-wait' : ''}`}>
            <input type="hidden" name="source" value={source} />
            {honeypot}
            <label htmlFor={id} className="sr-only">Email address</label>
            <input
              id={id} name="email" type="email" required autoComplete="email" placeholder="you@example.com"
              defaultValue={state?.email ?? ''}
              className="h-11 w-full min-w-0 flex-1 rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
            />
            <button
              type="submit" disabled={pending}
              className={`inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-success px-5 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
            >
              {pending ? 'Signing up…' : 'Get it monthly'}
            </button>
          </form>
        )}
        {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="w-full">
        {state?.subscribed ? (
          <p role="status" className="text-sm text-light-blue">
            You&apos;re on the list{state.email ? <> at <span className="font-medium text-white">{state.email}</span></> : ''}. Thanks!
          </p>
        ) : (
          <form action={action} noValidate className={`flex flex-col gap-2 sm:flex-row sm:items-center ${pending ? 'cursor-wait' : ''}`}>
            <input type="hidden" name="source" value={source} />
            {honeypot}
            <label htmlFor={id} className="shrink-0 text-sm font-medium text-white">
              The job market, once a week:
            </label>
            <input
              id={id} name="email" type="email" required autoComplete="email" placeholder="you@example.com"
              defaultValue={state?.email ?? ''}
              className="h-10 w-full min-w-0 flex-1 rounded-lg border border-white/30 bg-white/95 px-3 text-sm text-navy outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:max-w-xs"
            />
            <button
              type="submit" disabled={pending}
              className={`inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-success px-4 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
            >
              {pending ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        )}
        {state?.error && <p role="alert" className="mt-2 text-sm text-orange">{state.error}</p>}
      </div>
    )
  }

  const copy = COPY[variant]
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-bold tracking-tight text-navy">{copy.heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{copy.body}</p>

      {state?.subscribed ? (
        <p role="status" className="mx-auto mt-6 max-w-md rounded-xl border border-success/30 bg-success/5 px-5 py-4 text-sm text-navy">
          You&apos;re on the list{state.email ? <> at <span className="font-medium">{state.email}</span></> : ''}. The next email goes out Tuesday.
        </p>
      ) : (
        <form action={action} noValidate className={`mx-auto mt-6 max-w-md ${pending ? 'cursor-wait' : ''}`}>
          <input type="hidden" name="source" value={source} />
          {honeypot}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={id} className="sr-only">Email address</label>
            <input
              id={id} name="email" type="email" required autoComplete="email" placeholder="you@example.com"
              defaultValue={state?.email ?? ''}
              className="h-11 w-full min-w-0 flex-1 rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
            />
            <button
              type="submit" disabled={pending}
              className={`inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-success px-5 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
            >
              {pending ? 'Signing up…' : copy.cta}
            </button>
          </div>
          {state?.error && <p role="alert" className="mt-2 text-left text-sm text-destructive">{state.error}</p>}
        </form>
      )}
    </div>
  )
}
