'use client'

import { useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { refreshOrgContext } from '@/app/support/admin/(portal)/crm/context-actions'

/** Recounts this county's open jobs (cached for six hours) and reloads the panel. */
export function CrmOrgContextRefresh({ fips }: { fips: string | null }) {
  const [pending, start] = useTransition()
  const path = usePathname()
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await refreshOrgContext(fips, path) })}
      className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-60">
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}
