'use client'

import { useState, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95'
const more = 'text-sm font-medium text-brand underline underline-offset-4'

/** Move plan: "Add a place" is one button that opens the form in place, so the member's own places are not pushed down by a form they rarely need. */
export function AddPlaceShell({ startOpen, places, form }: { startOpen: boolean; places: number; form: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  if (!open) {
    return <button type="button" onClick={() => { posthog.capture('move_place_add_started', { source: 'move_plan_primary', places }); setOpen(true) }} className={PRIMARY}>Add a place</button>
  }
  return (
    <section id="add-place" aria-label="Add a place" className="space-y-3 rounded-2xl border border-border p-5">
      {form}
      {!startOpen && <button type="button" onClick={() => setOpen(false)} className={more}>Close without adding</button>}
    </section>
  )
}
