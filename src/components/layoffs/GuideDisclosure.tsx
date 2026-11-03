'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'

/**
 * The layoff guide, closed until the reader wants it. A native <details>, so the whole guide stays in the page HTML for
 * search engines and works without JavaScript; the toggle only records that someone opened it.
 */
export function GuideDisclosure({ company, heading, intro, children }: { company: string; heading: string; intro: string; children: ReactNode }) {
  return (
    <details
      className="group mt-12 rounded-2xl border border-border bg-white"
      onToggle={(e) => {
        const open = (e.currentTarget as HTMLDetailsElement).open
        try {
          posthog.capture(open ? 'layoff_guide_opened' : 'layoff_guide_closed', { company })
        } catch {}
      }}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-2xl p-5 [&::-webkit-details-marker]:hidden">
        <span>
          <h2 id="guide" className="text-2xl font-bold tracking-tight text-navy">{heading}</h2>
          <span className="mt-2 block max-w-3xl text-sm text-muted-foreground">{intro}</span>
        </span>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
          <span className="group-open:hidden">Show the guide</span>
          <span className="hidden group-open:inline">Hide the guide</span>
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="px-5 pb-6">{children}</div>
    </details>
  )
}
