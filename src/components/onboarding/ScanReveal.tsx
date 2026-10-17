'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getScanSummaryAction } from '@/app/onboarding/reveal/actions'
import { posthog } from '@/lib/posthog/client'
import { hasAnyFindings, rejectionNote, revealLines, type ScanSummary } from '@/lib/onboarding/scan-summary-core'

const POLL_MS = 3000
const MAX_POLLS = 120 // six minutes; after that the read carries on in the background
const SLOW_AFTER_POLLS = 80

export type TrackingOutcome = 'on' | 'pending' | 'off' | null

// "Here's what we found": the first read of the member's inbox and calendar,
// shown as it happens and then as a short summary. Applications and interviews
// are counts; networking is always "about" (see revealLines).
export function ScanReveal({ initial, tracking }: { initial: ScanSummary; tracking: TrackingOutcome }) {
  const [summary, setSummary] = useState(initial)
  const [polls, setPolls] = useState(0)
  const reported = useRef(false)

  const running = summary.state === 'starting' || summary.state === 'reading'

  useEffect(() => {
    if (!running || polls >= MAX_POLLS) return
    const timer = setTimeout(async () => {
      const next = await getScanSummaryAction().catch(() => null)
      if (next) setSummary(next)
      setPolls((n) => n + 1)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [running, polls])

  useEffect(() => {
    if (summary.state !== 'done' || reported.current) return
    reported.current = true
    posthog.capture('scan_reveal_viewed', { ...summary.counts, waitedSeconds: Math.round((polls * POLL_MS) / 1000) })
  }, [summary, polls])

  if (summary.state === 'not_connected') {
    return (
      <section aria-labelledby="scan-heading" className="space-y-2 rounded-xl border border-border bg-white p-6">
        <h2 id="scan-heading" className="text-base font-semibold">
          {tracking === 'pending' ? 'Inbox tracking is waiting for approval' : 'Inbox tracking is off'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tracking === 'pending'
            ? "While Google reviews our app we switch on new accounts by hand. We'll email you as soon as yours is on, and nothing is lost in the meantime."
            : "You signed in without connecting your inbox and calendar. You can turn tracking on any time, and it will count your applications and conversations for you."}
        </p>
        {tracking !== 'pending' && (
          <Link href="/dashboard/network" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Turn on tracking from Network
          </Link>
        )}
      </section>
    )
  }

  const percent = Math.round(summary.progress * 100)
  const lines = revealLines(summary.counts)
  const note = rejectionNote(summary.counts.rejections)

  return (
    <section aria-labelledby="scan-heading" className="space-y-4 rounded-xl border border-border bg-white p-6">
      <h2 id="scan-heading" className="text-base font-semibold">
        {running ? 'Reading the last 3 months of your search' : "Here's what we found"}
      </h2>

      {running && (
        <div className="space-y-2">
          <div
            role="progressbar"
            aria-label="Reading your inbox and calendar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${Math.max(percent, 4)}%` }} />
          </div>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {polls >= SLOW_AFTER_POLLS
              ? "This is a big inbox, so it's taking a while. You can carry on. We'll keep reading in the background."
              : 'This usually takes about a minute. The numbers below fill in as we go.'}
          </p>
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        {lines.map((line) => (
          <div key={line.key} className="rounded-lg bg-muted/50 p-4">
            <dd className="text-2xl font-semibold tabular-nums text-navy">{line.display}</dd>
            <dt className="text-sm text-muted-foreground">{line.label}</dt>
          </div>
        ))}
      </dl>

      {!running && (
        <>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
          {!hasAnyFindings(summary.counts) && (
            <p className="text-sm text-muted-foreground">
              We didn&apos;t find any job-search activity yet. That&apos;s fine. As you start, it shows up here on its own.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Counts are our best read. You&apos;ll be able to correct anything that looks wrong.
          </p>
        </>
      )}
    </section>
  )
}
