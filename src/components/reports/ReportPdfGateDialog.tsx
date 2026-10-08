'use client'

import { useActionState, useEffect, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Dialog, DialogPopup } from '@/components/ui/dialog'
import { subscribeToNewsletter, type NewsletterState } from '@/lib/newsletter/actions'

/**
 * Email gate for the PDF download. The full report stays free to read on the
 * page — this only gates the convenience PDF, and researchers/press have an
 * ungated direct link (#pdf-direct) in the cover. Subscribing uses the one
 * newsletter list with source `displacement-report-pdf`.
 */
export function ReportPdfGateDialog({
  open,
  onOpenChange,
  pdfHref,
  filename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfHref: string
  filename: string
}) {
  const posthog = usePostHog()
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeToNewsletter, undefined)
  const firedRef = useRef(false)

  useEffect(() => {
    if (state?.subscribed && !firedRef.current) {
      firedRef.current = true
      posthog?.capture('report_pdf_gate_submitted', { email_domain: state.email?.split('@')[1] })
    }
  }, [state?.subscribed, state?.email, posthog])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        aria-labelledby="pdf-gate-title"
        className="w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-white p-6 shadow-xl sm:w-full"
      >
        {state?.subscribed ? (
          <div className="space-y-4">
            <h2 id="pdf-gate-title" className="text-lg font-bold tracking-tight text-navy">
              You&apos;re subscribed — your PDF is ready
            </h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll send the next edition to your inbox when it publishes. Download this one now:
            </p>
            <a
              href={pdfHref}
              download={filename}
              onClick={() => posthog?.capture('report_pdf_downloaded', { gated: true })}
              className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white hover:bg-success-hover"
            >
              Download the PDF →
            </a>
            <div className="pt-1">
              <button type="button" onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground underline underline-offset-4">
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 id="pdf-gate-title" className="text-lg font-bold tracking-tight text-navy">
              Get the PDF edition
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your email for the PDF and the report each month. The full report is free to read on this page
              either way.
            </p>
            <form action={action} noValidate className={`space-y-3 ${pending ? 'cursor-wait' : ''}`}>
              <input type="hidden" name="source" value="displacement-report-pdf" />
              <div className="hidden" aria-hidden>
                <label htmlFor="pdf-gate-website">Website</label>
                <input id="pdf-gate-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <label htmlFor="pdf-gate-email" className="sr-only">Email address</label>
              <input
                id="pdf-gate-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                defaultValue={state?.email ?? ''}
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
              />
              {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="submit" disabled={pending}
                  className={`inline-flex h-11 items-center justify-center rounded-lg bg-success px-5 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
                >
                  {pending ? 'Sending…' : 'Email me the PDF →'}
                </button>
                <button type="button" onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground underline underline-offset-4">
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
