'use client'

import { useState, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95'
const more = 'text-sm font-medium text-brand underline underline-offset-4'

/**
 * Invite someone, once (docs/candidate-redesign.md): one action with two adjacent choices, a supporter (a weekly note, can cheer) or a
 * partner (their own account, search together), and one form for the choice. A member with nobody yet sees it open; otherwise it is one button.
 */
export function InviteShell({ startOpen, canPartner, supporterForm, partnerForm }: { startOpen: boolean; canPartner: boolean; supporterForm: ReactNode; partnerForm: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  const [kind, setKind] = useState<'supporter' | 'partner'>('supporter')
  if (!open) {
    return (
      <button type="button" onClick={() => { posthog.capture('supporter_invite_started', { source: 'people_primary' }); setOpen(true) }} className={PRIMARY}>
        Invite someone
      </button>
    )
  }
  return (
    <section id="invite" aria-label="Invite someone" className="space-y-4 rounded-2xl border border-border p-5">
      <h2 className="font-display text-xl font-semibold text-ink">Invite someone</h2>
      {canPartner && (
        <div role="group" aria-label="Who to invite" className="flex flex-wrap gap-2">
          {([['supporter', 'A supporter'], ['partner', 'A partner']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', kind === k ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:bg-muted')}>{l}</button>
          ))}
        </div>
      )}
      <p className="max-w-xl text-sm text-muted-foreground">
        {kind === 'supporter'
          ? 'They get one short note a week about your effort, in numbers only, and can send you a cheer. They never see names, companies or messages, and you can remove them any time.'
          : 'Search together, especially if you may move. Your partner gets their own free account and their own search.'}
      </p>
      {kind === 'supporter' ? supporterForm : partnerForm}
      {startOpen === false && <button type="button" onClick={() => setOpen(false)} className={more}>Close without inviting</button>}
    </section>
  )
}

/** Move plan: "Add a place" is one button that opens the form in place, so the member's own places are not pushed down by a form they rarely need. */
export function AddPlaceShell({ startOpen, form }: { startOpen: boolean; form: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  if (!open) {
    return <button type="button" onClick={() => { posthog.capture('move_place_add_started', { source: 'move_plan_primary' }); setOpen(true) }} className={PRIMARY}>Add a place</button>
  }
  return (
    <section id="add-place" aria-label="Add a place" className="space-y-3 rounded-2xl border border-border p-5">
      {form}
      {!startOpen && <button type="button" onClick={() => setOpen(false)} className={more}>Close without adding</button>}
    </section>
  )
}
