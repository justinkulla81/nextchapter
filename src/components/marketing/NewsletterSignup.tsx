'use client'

import { useActionState } from 'react'
import { subscribeToNewsletter, type NewsletterState } from '@/lib/newsletter/actions'

/**
 * The weekly-email signup: one field, no account.
 *
 * `source` records which page's box was used. The copy says what arrives and
 * how often, because that is the whole decision someone is making here.
 */
export function NewsletterSignup({ source }: { source: 'home' | 'how-it-works' | 'why-stuck' | 'displacement-report' }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeToNewsletter, undefined)
  const id = `newsletter-${source}`

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-bold tracking-tight text-navy">The job market, once a week</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
        One email every Tuesday with the week&apos;s most useful read on the job market and the search, plus occasional
        news from NextChapter. No account needed. Unsubscribe any time.
      </p>

      {state?.subscribed ? (
        <p role="status" className="mx-auto mt-6 max-w-md rounded-xl border border-success/30 bg-success/5 px-5 py-4 text-sm text-navy">
          You&apos;re on the list{state.email ? <> at <span className="font-medium">{state.email}</span></> : ''}. The next email goes out Tuesday.
        </p>
      ) : (
        <form action={action} noValidate className={`mx-auto mt-6 max-w-md ${pending ? 'cursor-wait' : ''}`}>
          <input type="hidden" name="source" value={source} />
          {/* Hidden from people; a bot that fills it in is turned away. */}
          <div className="hidden" aria-hidden>
            <label htmlFor={`${id}-website`}>Website</label>
            <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
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
              {pending ? 'Signing up…' : 'Get the weekly email'}
            </button>
          </div>
          {state?.error && <p role="alert" className="mt-2 text-left text-sm text-destructive">{state.error}</p>}
        </form>
      )}
    </div>
  )
}
