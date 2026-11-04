'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'sending' | 'sent' | 'signed_out' | 'failed'

/**
 * What a member sees when a page fails to render, or the page's data does not arrive in time. One headline, one primary action
 * (reload), and a second button that files the problem for them with the page and the error reference attached, so nobody has to
 * describe it. Replaces Next's bare "This page couldn't load" screen.
 */
export function ErrorView({
  error,
  homeHref,
  homeLabel,
  contactHref = 'https://launchyournextchapter.com/contact',
  canFile,
}: {
  error: Error & { digest?: string }
  homeHref: string
  homeLabel: string
  contactHref?: string
  /** True where the visitor is signed in (the dashboard): the "Tell us" button files a ticket. Elsewhere it links to the contact page. */
  canFile: boolean
}) {
  const pathname = usePathname()
  const [status, setStatus] = useState<Status>('idle')
  const digest = error.digest

  useEffect(() => {
    posthog.capture('page_error_shown', { path: pathname, digest: digest ?? null, errorName: error.name, canFile })
  }, [pathname, digest, error.name, canFile])

  async function tellUs() {
    setStatus('sending')
    posthog.capture('page_error_report_clicked', { path: pathname, digest: digest ?? null })
    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: pathname, digest: digest ?? null, title: document.title }),
      })
      setStatus(res.ok ? 'sent' : res.status === 401 ? 'signed_out' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <main className="theme-redesign mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center px-6 py-16 text-ink" aria-live="polite">
      <h1 className="font-display text-3xl font-semibold tracking-tight">This page didn’t load</h1>
      <p className="mt-3 text-base text-muted-foreground">
        That was on our side, not yours, and your information is safe. Reload to try again{canFile ? ', or tell us and we will look into it' : ''}.
      </p>
      {digest ? <p className="mt-2 text-sm text-muted-foreground">Error reference: {digest}</p> : null}

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={() => {
            posthog.capture('page_error_reload_clicked', { path: pathname, digest: digest ?? null })
            window.location.reload()
          }}
          className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
        >
          Reload this page
        </button>
        <Link href={homeHref} className="text-sm font-medium text-ink underline underline-offset-4">
          {homeLabel}
        </Link>
      </div>

      <div className="mt-8 border-t pt-6">
        {status === 'sent' ? (
          <p className="text-sm text-ink">Sent. We have the page and the error reference, so there is nothing more you need to write.</p>
        ) : status === 'signed_out' || !canFile ? (
          <p className="text-sm text-muted-foreground">
            Still stuck? <a className="font-medium text-ink underline underline-offset-4" href={contactHref}>Write to us</a> and include the error reference.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={tellUs}
              disabled={status === 'sending'}
              aria-describedby="tell-us-why"
              className={cn('text-sm font-medium text-ink underline underline-offset-4', status === 'sending' && 'cursor-wait opacity-70')}
            >
              {status === 'sending' ? 'Sending…' : 'Tell us about this'}
            </button>
            <p id="tell-us-why" className="mt-1 text-sm text-muted-foreground">
              {status === 'failed'
                ? 'That did not send. Try again, or write to us from the contact page.'
                : 'Sends us this page and the error reference. You do not need to write anything.'}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
