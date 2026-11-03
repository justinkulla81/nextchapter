'use client'

import { useState, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

/**
 * The capture block for data-first pages (the rankings): a single slim row so the lists are on screen on arrival, and the
 * first journey question opens in place on a click.
 */
export function CollapsibleCapture({ label, source, children }: { label: string; source: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section aria-label={`Get started: ${label}`} className="mt-6 rounded-2xl bg-gradient-to-br from-tint-sky via-white to-tint-mint px-4 py-3 sm:px-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="capture-panel"
        onClick={() => {
          if (!open) posthog.capture('capture_expanded', { source })
          setOpen(!open)
        }}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-base font-semibold text-navy">
          Where are you right now? <span className="hidden font-normal text-muted-foreground sm:inline">Get a first-week plan by email. No résumé, no account.</span>
        </span>
        <span className="shrink-0 rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-navy">{open ? 'Close' : 'Answer'}</span>
      </button>
      {open && (
        <div id="capture-panel" className="mt-4 border-t border-border pt-4">
          {children}
        </div>
      )}
    </section>
  )
}
