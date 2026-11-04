'use client'

import type { ReactNode } from 'react'
import { usePostHog } from '@/lib/posthog/client'

/**
 * "Show all N" under a capped list. The rest of the rows are already in the page (server-rendered inside a native
 * details element), so it works without JavaScript and the page stays cacheable. Opening it fires one event.
 */
export function ShowAllGroup({ label, event, properties, children }: { label: string; event: string; properties: Record<string, unknown>; children: ReactNode }) {
  const posthog = usePostHog()
  return (
    <details className="group mt-3" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) posthog?.capture(event, properties) }}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand hover:underline group-open:hidden">{label}</summary>
      {children}
    </details>
  )
}
