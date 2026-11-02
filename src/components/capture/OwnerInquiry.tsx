'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { submitOwnerInquiry, type OwnerInquiryState } from '@/lib/leads/owner-inquiry'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

/** For the organization behind a page: one work-email field that files an inquiry, and a link to the full page for that audience. */
export function OwnerInquiry({ who, what, href, hrefLabel, source, label }: { who: string; what: string; href: string; hrefLabel: string; source: string; label: string }) {
  const [state, action, pending] = useActionState<OwnerInquiryState, FormData>(submitOwnerInquiry, undefined)

  if (state?.sent) {
    return (
      <section aria-label="Organization inquiry" className="mt-8 rounded-3xl bg-tint-mint p-5 sm:p-6">
        <p role="status" className="text-sm">
          Thanks. We&apos;ll write to{state.email ? <> <span className="font-medium">{state.email}</span></> : ' you'} shortly.{' '}
          <Link href={href} className="font-medium text-brand underline underline-offset-4">{hrefLabel}</Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Organization inquiry" className={cn('mt-8 rounded-3xl bg-tint-plum p-5 sm:p-6', pending && 'cursor-wait')}>
      <p className="text-sm font-semibold text-navy">{who}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{what}</p>
      <form
        action={action}
        noValidate
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={() => posthog.capture('owner_inquiry_submitted_client', { source })}
      >
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="label" value={label} />
        <div className="hidden" aria-hidden>
          <label htmlFor="owner-website">Website</label>
          <input id="owner-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="sr-only" htmlFor="owner-email">Work email address</label>
        <input
          id="owner-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state?.email}
          placeholder="you@yourorganization.org"
          aria-invalid={state?.error ? true : undefined}
          className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base"
        />
        <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Sending…' : 'Send me details'}
        </Button>
      </form>
      {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
      <p className="mt-2 text-xs">
        <Link
          href={href}
          onClick={() => posthog.capture('owner_inquiry_page_link_clicked', { source })}
          className="text-brand underline underline-offset-4"
        >
          {hrefLabel}
        </Link>
      </p>
    </section>
  )
}
