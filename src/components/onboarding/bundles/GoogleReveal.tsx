'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { completeGoogleReveal, pollScan } from '@/app/onboarding/bundle-actions'
import { ConnectGmailCalendarButton } from '@/components/dashboard/ConnectGmailCalendarButton'
import { InlineLoadingState } from '@/components/ui/spinner'
import { usePostHog } from '@/lib/posthog/client'
import type { ScanStatus } from '@/lib/onboarding/scan-counts'
import { CONNECT_REASSURANCE, WHY_CONNECT, describeFindings } from '@/lib/onboarding/scan-reveal'
import { cn } from '@/lib/utils'
import { PrimaryAction } from './PrimaryAction'

const POLL_MS = 4000
const POLL_LIMIT = 20

function SkipButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn('text-sm font-medium text-brand underline underline-offset-4', pending ? 'cursor-progress' : 'cursor-pointer')}>
      {pending ? 'One moment…' : 'Skip for now'}
    </button>
  )
}

// The last step of the short question bundles: what a Gmail and Calendar scan finds, and why connecting helps.
// Optional and skippable at every state. Reuses the existing connect button, with its trust pop-up, and the
// existing OAuth start route (which returns here). The first scan runs in the background after connecting, so
// this page asks again every few seconds until both connections have synced once.
export function GoogleReveal({ initial, connectHref, errorMessage, reason }: { initial: ScanStatus; connectHref: string; errorMessage: string | null; reason: string }) {
  const [status, setStatus] = useState(initial)
  const [polls, setPolls] = useState(0)
  const posthog = usePostHog()

  useEffect(() => {
    posthog?.capture('onboarding_google_reveal_viewed', { state: initial.state, error: errorMessage ? true : false })
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status.state !== 'scanning' || polls >= POLL_LIMIT) return
    const timer = setTimeout(async () => {
      try {
        setStatus(await pollScan())
      } catch {
        // A failed check is not an error to show: the next one tries again.
      }
      setPolls((n) => n + 1)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [status.state, polls])

  const findings = describeFindings(status.counts)
  const waiting = status.state === 'scanning' && polls < POLL_LIMIT

  return (
    <div className="space-y-8">
      {status.state === 'not_connected' && (
        <>
          <div className="space-y-3">
            <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">Want us to find what you have already done?</h1>
            <p className="text-base text-muted-foreground">{reason}</p>
          </div>
          <ul className="space-y-3 rounded-2xl bg-muted/60 p-5">
            {WHY_CONNECT.map((line) => (
              <li key={line} className="flex gap-3 text-base text-ink">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{CONNECT_REASSURANCE}</p>
          {errorMessage && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-6">
            <ConnectGmailCalendarButton
              href={connectHref}
              label="Connect Gmail and Calendar"
              analyticsKey="onboarding_google_reveal"
              className="inline-flex h-11 cursor-pointer items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <form action={completeGoogleReveal}>
              <input type="hidden" name="outcome" value="skip" />
              <SkipButton />
            </form>
          </div>
          <p className="text-sm text-muted-foreground">Skipping loses nothing. You can connect any time from Account and privacy.</p>
        </>
      )}

      {status.state !== 'not_connected' && (
        <>
          <div className="space-y-3">
            <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">
              {findings.length > 0 ? 'Here is what we found.' : waiting ? 'Reading your email and calendar…' : status.state === 'nothing_yet' ? 'Connected. Nothing to count yet.' : 'Still reading. You can carry on.'}
            </h1>
            <p className="text-base text-muted-foreground">
              {findings.length > 0
                ? 'This is already counted. You did not have to type any of it.'
                : status.state === 'nothing_yet'
                  ? 'We did not see job-search emails or calls yet. As you search, they are logged for you.'
                  : 'We are looking for applications, replies, interview invites and calls. It can take a minute.'}
            </p>
          </div>

          {waiting && <InlineLoadingState label="Looking through your recent email and calendar…" />}

          {findings.length > 0 && (
            <ul className="space-y-3">
              {findings.map((f) => (
                <li key={f.key} className="space-y-1 rounded-2xl border border-border p-5">
                  <p className="font-display text-xl font-semibold text-ink">{f.title}</p>
                  <p className="text-base text-muted-foreground">{f.why}</p>
                </li>
              ))}
            </ul>
          )}
          {status.state === 'scanning' && polls >= POLL_LIMIT && <p className="text-sm text-muted-foreground">It is taking longer than usual. Whatever we find shows up on your home page when it is done.</p>}

          <form action={completeGoogleReveal} className="space-y-2">
            <input type="hidden" name="outcome" value="continue" />
            <PrimaryAction pendingLabel="One moment…">{findings.length > 0 ? 'Continue' : 'Continue to your welcome'}</PrimaryAction>
          </form>
        </>
      )}
    </div>
  )
}
