'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Dialog, DialogPopup } from '@/components/ui/dialog'
import { subscribeToNewsletter, type NewsletterState } from '@/lib/newsletter/actions'
import { hasSubscribedCookie } from './use-subscribed'

const DISMISS_KEY = 'nc_report_popup_dismissed_at'
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

function dismissedRecently(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY)
    return !!v && Date.now() - Number(v) < THIRTY_DAYS
  } catch {
    return false
  }
}
function recordDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // Private mode / storage disabled: fall back to showing once per session.
  }
}

/**
 * A polite newsletter pop-up for report pages. It never appears on load — only
 * after the reader scrolls halfway or stays 45 seconds — so it does not block
 * content for search visitors (Google intrusive-interstitial guidance). It is
 * suppressed for 30 days after a dismissal and permanently for subscribers.
 * The report underneath is fully readable without it.
 */
export function ReportNewsletterPopup({ placement }: { placement: string }) {
  const posthog = usePostHog()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeToNewsletter, undefined)
  const shownRef = useRef(false)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (hasSubscribedCookie() || dismissedRecently()) return
    let fired = false
    const reveal = () => {
      if (fired) return
      fired = true
      shownRef.current = true
      cleanup()
      setOpen(true)
      posthog?.capture('newsletter_popup_shown', { placement })
    }
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable > 0 && window.scrollY / scrollable >= 0.5) reveal()
    }
    const timer = setTimeout(reveal, 45000)
    window.addEventListener('scroll', onScroll, { passive: true })
    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
    return cleanup
  }, [placement, posthog])

  useEffect(() => {
    if (state?.subscribed && !submittedRef.current) {
      submittedRef.current = true
      recordDismissal() // a subscriber should not see it again even before the cookie is read
      posthog?.capture('newsletter_popup_submitted', { placement })
    }
  }, [state?.subscribed, placement, posthog])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next && !state?.subscribed) {
      recordDismissal()
      posthog?.capture('newsletter_popup_dismissed', { placement })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup
        aria-labelledby="report-popup-title"
        className="bottom-0 left-1/2 top-auto w-screen max-w-none -translate-x-1/2 translate-y-0 rounded-t-2xl bg-white p-6 shadow-xl sm:bottom-auto sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl"
      >
        {state?.subscribed ? (
          <div className="space-y-3">
            <h2 id="report-popup-title" className="text-lg font-bold tracking-tight text-navy">You&apos;re on the list</h2>
            <p className="text-sm text-muted-foreground">
              The next edition lands in your inbox the week the jobs report comes out. Thanks for reading.
            </p>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-brand underline underline-offset-4">
              Back to the report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 id="report-popup-title" className="text-lg font-bold tracking-tight text-navy">
              Get the Displacement Report monthly
            </h2>
            <p className="text-sm text-muted-foreground">
              New data on white-collar job loss and the White-Collar Long-Term Unemployment Index, the week the jobs report comes
              out. Free, unsubscribe any time.
            </p>
            <form action={action} noValidate className={`space-y-3 ${pending ? 'cursor-wait' : ''}`}>
              <input type="hidden" name="source" value="displacement-report-popup" />
              <div className="hidden" aria-hidden>
                <label htmlFor="report-popup-website">Website</label>
                <input id="report-popup-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <label htmlFor="report-popup-email" className="sr-only">Email address</label>
              <input
                id="report-popup-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                defaultValue={state?.email ?? ''}
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
              />
              {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
              <div className="flex items-center gap-4">
                <button
                  type="submit" disabled={pending}
                  className={`inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-success px-5 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
                >
                  {pending ? 'Signing up…' : 'Get the report monthly'}
                </button>
                <button type="button" onClick={() => handleOpenChange(false)} className="shrink-0 text-sm text-muted-foreground underline underline-offset-4">
                  No thanks
                </button>
              </div>
            </form>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}
