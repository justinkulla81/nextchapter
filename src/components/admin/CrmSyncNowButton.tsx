'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

/**
 * Runs the mail and calendar sweeps on demand.
 *
 * The scheduled sweep runs on an interval measured in hours, which is right
 * for keeping 3,700 people current and wrong for the moment you have just
 * emailed someone and want to see it on their row. This closes that gap
 * without making the scheduled sweep run more often — see the route for why
 * its window is deliberately small.
 *
 * When only reconnecting Google can fix the sync (not connected, access
 * expired, a permission missing) it becomes Reconnect & sync: Google's
 * consent screen returns to this same page with ?googleConnected=1, and the
 * sync then runs on its own — one click for both.
 */
// Several buttons can share a page (header + alert); only one auto-runs.
let autoRanThisLoad = false

export function CrmSyncNowButton({ needsReconnect = false }: { needsReconnect?: boolean } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const justReconnected = searchParams.get('googleConnected') === '1'
  const [leaving, setLeaving] = useState(false)
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
        const total = data.created + (data.meetings ?? 0)
        const base = total > 0
          ? `${total} new ${total === 1 ? 'activity' : 'activities'}`
          : `Nothing new in the last ${data.windowHours}h`
        // Never let a partial run read as a complete one.
        setResult(data.failed > 0 ? `${base} · ${data.failed} couldn’t be read — run again` : base)
        // Drop ?googleConnected so a reload doesn't sync again.
        if (justReconnected) router.replace(pathname)
        else router.refresh()
      }
    } catch {
      setResult('Could not sync.')
    } finally {
      setBusy(false)
    }
  }

  // Right after reconnecting Google: catch up without waiting for a click.
  useEffect(() => {
    if (!justReconnected || autoRanThisLoad) return
    const t = setTimeout(() => {
      if (autoRanThisLoad) return
      autoRanThisLoad = true
      void run()
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReconnected])

  if (needsReconnect && !justReconnected) {
    return (
      <a
        href={`/api/google/oauth/start?from=${encodeURIComponent(pathname)}`}
        onClick={() => { setLeaving(true); posthog.capture('crm_google_reconnect_clicked', { from: pathname }) }}
        className={`rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 ${leaving ? 'cursor-wait opacity-70' : ''}`}
      >
        {leaving ? 'Opening Google…' : 'Reconnect & sync'}
      </a>
    )
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
