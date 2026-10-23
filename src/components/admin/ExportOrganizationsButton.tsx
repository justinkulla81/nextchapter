'use client'

import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'

/**
 * Downloads the Organizations list as it is filtered right now. The file is built on
 * the server, so a big list takes a moment: the button says so, shows a wait cursor,
 * and reports a failure in words instead of doing nothing.
 */
export function ExportOrganizationsButton({ query }: { query: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')

  async function download() {
    setState('busy')
    posthog.capture('crm_organizations_export_clicked', { filters: query || null })
    try {
      const res = await fetch(`/support/admin/crm/organizations/export${query ? `?${query}` : ''}`)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nextchapter-organizations-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <span className="flex items-center gap-2">
      {state === 'error' && (
        <span role="alert" className="text-xs text-red-700">
          The export did not finish. Narrow the filters or try again.
        </span>
      )}
      <button
        type="button"
        onClick={download}
        disabled={state === 'busy'}
        aria-busy={state === 'busy'}
        className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${state === 'busy' ? 'cursor-wait opacity-70' : ''}`}
      >
        {state === 'busy' ? 'Preparing CSV…' : 'Export CSV'}
      </button>
    </span>
  )
}
