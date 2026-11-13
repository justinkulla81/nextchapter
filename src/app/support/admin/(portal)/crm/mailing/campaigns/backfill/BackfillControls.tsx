'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { discardDrafts, draftNextBatch, releaseForMonday, type BackfillState } from './actions'

const PRIMARY = 'h-11 rounded-full bg-navy px-5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-wait disabled:opacity-70'
const SECONDARY = 'h-11 rounded-full border border-border bg-white px-5 text-sm font-semibold text-navy hover:bg-off-white disabled:cursor-wait disabled:opacity-70'

/** The three steps of the backfill. Release and discard ask for a second click that names what will happen. */
export function BackfillControls({ held, pending, releaseLabel, releasable }: { held: { editions: number; recipients: number }; pending: number; releaseLabel: string; releasable: boolean }) {
  const [state, setState] = useState<BackfillState>()
  const [confirm, setConfirm] = useState<'release' | 'discard' | null>(null)
  const [busy, start] = useTransition()
  const run = (name: string, fn: () => Promise<BackfillState>) => start(async () => {
    posthog.capture('layoff_backfill_action', { action: name, held: held.recipients, pending })
    setConfirm(null)
    setState(await fn())
  })

  return (
    <div className={busy ? 'cursor-wait' : ''}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || pending === 0} className={PRIMARY} onClick={() => run('draft_next_batch', draftNextBatch)}>
          {busy ? 'Working…' : `Draft the next 15 layoffs (${pending} left)`}
        </button>
        {pending === 0 && <span className="text-sm text-muted-foreground">Every pending layoff has been looked at.</span>}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {confirm === 'release' ? (
          <>
            <button type="button" disabled={busy} className={PRIMARY} onClick={() => run('release', releaseForMonday)}>
              Yes, schedule {held.recipients.toLocaleString('en-US')} emails for {releaseLabel}
            </button>
            <button type="button" disabled={busy} className={SECONDARY} onClick={() => setConfirm(null)}>Cancel</button>
          </>
        ) : (
          <button type="button" disabled={busy || !releasable} className={SECONDARY} onClick={() => setConfirm('release')} aria-describedby="release-why">
            Schedule for {releaseLabel}
          </button>
        )}
        {!releasable && <span id="release-why" className="text-sm text-muted-foreground">Draft at least one layoff first; there is nothing held to schedule.</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {confirm === 'discard' ? (
          <>
            <button type="button" disabled={busy} className="h-11 rounded-full bg-red-700 px-5 text-sm font-semibold text-white disabled:opacity-70" onClick={() => run('discard', discardDrafts)}>
              Yes, delete {held.editions} held drafts
            </button>
            <button type="button" disabled={busy} className={SECONDARY} onClick={() => setConfirm(null)}>Cancel</button>
          </>
        ) : (
          <button type="button" disabled={busy || held.editions === 0} className={SECONDARY} onClick={() => setConfirm('discard')}>Delete held drafts</button>
        )}
      </div>

      {state?.message && <p role="status" className="mt-4 text-sm font-medium text-navy">{state.message}</p>}
      {state?.error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{state.error}</p>}
    </div>
  )
}
