'use client'

import { useId, useState, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

/**
 * Options shown as their current choice in one line ("Full-time · Any arrangement · Best match"), with a Change button that
 * opens the full set. Owner, 2026-11-17: show what is chosen, and the options only to people who want to change them.
 */
export function CollapsedOptions({
  summary,
  surface,
  label = 'Change',
  children,
}: {
  /** The current choices, already joined, e.g. "Full-time · Any arrangement · Best match". */
  summary: string
  /** For analytics: which page or box the options belong to. */
  surface: string
  label?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ink">{summary}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            const next = !open
            setOpen(next)
            if (next) posthog.capture('options_expanded', { surface })
          }}
          className="rounded-md px-1 font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {open ? 'Done' : label}
        </button>
      </div>
      {open && (
        <div id={id} className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {children}
        </div>
      )}
    </div>
  )
}
