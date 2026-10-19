'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// "Show more" for a redesigned page: everything past the first three sections sits behind one control.
// It records which page and whether it was opened, so we can see what people go looking for.
export function ShowMore({ label, event, properties, children }: { label: string; event: string; properties?: Record<string, unknown>; children: ReactNode }) {
  return (
    <details
      className="group space-y-6"
      onToggle={(e) => posthog.capture(event, { ...properties, open: (e.currentTarget as HTMLDetailsElement).open })}
    >
      <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Show less</span>
      </summary>
      <div className="space-y-6 pt-4">{children}</div>
    </details>
  )
}
