'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// "Show more" for a redesigned page: everything past the first three sections sits behind one control, so nothing is
// removed and it is one click away. Native <details> keeps it keyboard-accessible and working before scripts load.
// It records which page was opened, so we can see what people go looking for. Pass `page`, or `event` and `properties`
// when a page wants its own event name.
export function ShowMore({
  page,
  label = 'Show more',
  event = 'show_more_opened',
  properties,
  defaultOpen = false,
  children,
}: {
  page?: string
  label?: string
  event?: string
  properties?: Record<string, unknown>
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      className="group space-y-6"
      open={defaultOpen || undefined}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture(event, { ...(page ? { page, label } : {}), ...properties })
      }}
    >
      <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Show less</span>
      </summary>
      <div className="space-y-8 pt-4">{children}</div>
    </details>
  )
}
