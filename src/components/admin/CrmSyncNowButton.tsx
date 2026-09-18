'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pulls the last few hours of mail on demand.
 *
 * The scheduled sweep runs on an interval measured in hours, which is right
 * for keeping 3,700 people current and wrong for the moment you have just
 * emailed someone and want to see it on their row. This closes that gap
 * without making the scheduled sweep run more often — see the route for why
 * its window is deliberately small.
 */
export function CrmSyncNowButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/crm/sync-now', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) {
        setResult(data.message ?? 'Could not sync.')
      } else {
        const base = data.created > 0
          ? `${data.created} new ${data.created === 1 ? 'activity' : 'activities'}`
          : `Nothing new in the last ${data.windowHours}h`
        // Never let a partial run read as a complete one.
        setResult(data.failed > 0 ? `${base} · ${data.failed} couldn’t be read — run again` : base)
        router.refresh()
      }
    } catch {
      setResult('Could not sync.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${busy ? 'cursor-progress opacity-60' : ''}`}
      >
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </span>
  )
}
