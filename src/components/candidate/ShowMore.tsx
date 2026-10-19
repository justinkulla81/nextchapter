'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// "Show more": everything a page still offers but the first view does not need. Nothing is removed; it
// is one click away. Native <details> keeps it keyboard-accessible and working before scripts load.
export function ShowMore({ page, label = 'Show more', defaultOpen = false, children }: { page: string; label?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details
      className="group space-y-6"
      open={defaultOpen || undefined}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('show_more_opened', { page, label })
      }}
    >
      <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Show less</span>
      </summary>
      <div className="space-y-8 pt-2">{children}</div>
    </details>
  )
}
