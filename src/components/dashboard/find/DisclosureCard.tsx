'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'

// A card whose detail opens on demand: a title, one line saying what it is, a fact about the member's progress, and the
// detail under it. Native <details> keeps it keyboard-accessible and working before scripts load. Opening records
// which card, so we can see what people go looking for.
export function DisclosureCard({
  title,
  blurb,
  status,
  event,
  properties,
  children,
}: {
  title: string
  blurb: string
  status: string
  event: string
  properties?: Record<string, unknown>
  children: ReactNode
}) {
  return (
    <details
      className="group rounded-2xl border border-border bg-white"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture(event, properties)
      }}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl p-5 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="text-sm text-muted-foreground">{blurb}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">{status}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand underline underline-offset-4">
            <span className="group-open:hidden">Open</span>
            <span className="hidden group-open:inline">Close</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </div>
      </summary>
      <div className="space-y-4 border-t border-border p-5">{children}</div>
    </details>
  )
}
