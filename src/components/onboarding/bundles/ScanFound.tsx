'use client'

import { useEffect, useRef, useState } from 'react'
import { pollScan } from '@/app/onboarding/bundle-actions'
import { Module } from '@/components/candidate/Module'
import { InlineLoadingState } from '@/components/ui/spinner'
import { usePostHog } from '@/lib/posthog/client'
import type { ScanStatus } from '@/lib/onboarding/scan-counts'
import { describeFindings } from '@/lib/onboarding/scan-reveal'

const POLL_MS = 4000
const POLL_LIMIT = 20

export type TrackingOutcome = 'on' | 'pending' | 'off' | null

// "What we found": the first read of the member's Gmail and Calendar, shown on the payoff screen right after the
// Google step. The read runs in the background after connecting, so this asks again every few seconds until both
// connections have synced once. It only ever shows what was really counted.
export function ScanFound({ initial, tracking }: { initial: ScanStatus; tracking: TrackingOutcome }) {
  const [status, setStatus] = useState(initial)
  const [polls, setPolls] = useState(0)
  const posthog = usePostHog()
  const reported = useRef(false)

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

  useEffect(() => {
    if (reported.current || (status.state !== 'found' && status.state !== 'nothing_yet')) return
    reported.current = true
    posthog?.capture('onboarding_scan_found_viewed', { state: status.state, ...status.counts })
  }, [status, posthog])

  if (status.state === 'not_connected') {
    return (
      <Module title={tracking === 'pending' ? 'Inbox tracking is waiting for approval' : 'Inbox tracking is off'}>
        <p className="text-base text-muted-foreground">
          {tracking === 'pending'
            ? 'While Google reviews our app we switch on new accounts by hand. We will email you as soon as yours is on, and nothing is lost in the meantime.'
            : 'Your account is ready, but your inbox and calendar are not connected yet. You can connect them any time from Account and privacy.'}
        </p>
      </Module>
    )
  }

  const findings = describeFindings(status.counts)
  const waiting = status.state === 'scanning' && polls < POLL_LIMIT

  return (
    <Module title={findings.length > 0 ? 'What we found' : waiting ? 'Reading your email and calendar…' : status.state === 'nothing_yet' ? 'Connected. Nothing to count yet.' : 'Still reading. You can carry on.'}>
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

      {status.state === 'nothing_yet' && (
        <p className="text-base text-muted-foreground">We did not see job-search emails or calls yet. As you search, they are logged for you.</p>
      )}
      {status.state === 'scanning' && polls >= POLL_LIMIT && (
        <p className="text-sm text-muted-foreground">It is taking longer than usual. Whatever we find shows up on your home page when it is done.</p>
      )}
    </Module>
  )
}
