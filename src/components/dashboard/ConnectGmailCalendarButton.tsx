'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { X, ShieldCheck } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Trust pop-up shown before a candidate leaves NextChapter for Google's
// OAuth consent screen. Candidates have flagged discomfort connecting Gmail
// without knowing what access they're granting — this states the real
// scope (gmail.readonly + calendar.events.readonly, see
// src/lib/email-tracking/gmail-oauth.ts) in plain language before the
// redirect, rather than only after the fact. `href` is the real,
// already-built OAuth start URL (withOAuthReturnTo(...) applied by the
// caller) — this component only adds a confirmation step in front of it,
// it doesn't change where the button ultimately goes.
export function ConnectGmailCalendarButton({
  href,
  label,
  className,
  analyticsKey,
}: {
  href: string
  label: string
  className: string
  analyticsKey: string
}) {
  const posthog = usePostHog()
  const [open, setOpen] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) posthog?.capture('gmail_connect_trust_dialog_shown', { source: analyticsKey })
      }}
    >
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <DialogPopup className="max-h-[90vh] w-[min(92vw,28rem)] overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg">
        <DialogClose className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="flex items-center gap-2 pr-6">
          <ShieldCheck className="size-5 shrink-0 text-brand" />
          <h2 className="text-lg font-semibold tracking-tight">Turn on your networking &amp; job application CRM</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Connecting Gmail and Calendar is what makes NextChapter work like a CRM for your search —
          it automatically logs outreach, application replies, interview invites, and calls, so you
          never have to enter them by hand.
        </p>

        <ul className="mt-4 space-y-2.5 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              <strong>Read-only.</strong>{' '}
              We can never send, edit, or delete anything in your Gmail or Calendar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              We only look for outreach, application replies, interview invites, and calls — nothing
              else is read or stored.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>Disconnect anytime from Settings.</span>
          </li>
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">
          See our{' '}
          <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
            Privacy Policy
          </Link>{' '}
          for the full details on what we collect and how it&apos;s used.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
            onClick={() => {
              posthog?.capture('gmail_connect_trust_dialog_dismissed', { source: analyticsKey })
              setOpen(false)
            }}
          >
            Not now
          </button>
          <a
            href={href}
            className={cn(buttonVariants({ variant: 'default' }), 'flex-1')}
            onClick={() => posthog?.capture('gmail_connect_trust_dialog_continued', { source: analyticsKey })}
          >
            Continue to Google
          </a>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
