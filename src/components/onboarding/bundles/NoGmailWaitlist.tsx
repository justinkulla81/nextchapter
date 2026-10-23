'use client'

import { useState, type FormEvent } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// For people who cannot use the Google step because they have no personal Gmail (Outlook, a work account). It is not a
// way around the step: it keeps them in touch for when more accounts are supported. Posts to the same waitlist route
// the audience pages use. The email they typed stays in the box if anything goes wrong.
export function NoGmailWaitlist() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const posthog = usePostHog()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      setError('Enter an email address like name@example.com.')
      return
    }
    setError(null)
    setState('sending')
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience: 'onboarding_no_gmail', email: value }),
      })
      if (!response.ok) throw new Error(String(response.status))
      posthog?.capture('onboarding_no_gmail_waitlist_joined')
      setState('done')
    } catch {
      setState('idle')
      setError('We could not save your email just now. Please try again in a moment.')
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="text-sm font-medium text-ink">
        Thanks. We will email you when we support more kinds of account.
      </p>
    )
  }

  return (
    <form onSubmit={submit} noValidate className={cn('space-y-2', state === 'sending' && 'cursor-progress [&_*]:cursor-progress')}>
      <label htmlFor="no-gmail-email" className="block text-sm text-muted-foreground">
        No personal Gmail? Leave your email and we will tell you when we support more.
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="no-gmail-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'no-gmail-error' : undefined}
          className="h-10 w-64 max-w-full rounded-lg border border-border bg-white px-3 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="inline-flex h-10 cursor-pointer items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
        >
          {state === 'sending' ? 'Saving…' : 'Tell me when it is ready'}
        </button>
      </div>
      {error && (
        <p id="no-gmail-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
