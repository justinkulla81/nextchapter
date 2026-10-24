'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/app/support/coach/(app)/clients/[token]/[clientId]/notes/actions'

// Small pieces the session notes page shares. Look and wording follow src/app/dev-preview/_mockups/coach-session.tsx.

export type Notice = { kind: 'ok' | 'error'; text: string } | null

/**
 * One action at a time per section: runs a server action, keeps the busy state for the cursor (design principle 2)
 * and the plain-words result for the section's own status line. Inputs are only cleared by the caller's `after`,
 * which runs on success, so a failed save never loses what was typed.
 */
export function useAct() {
  const [pending, start] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const act = (fn: () => Promise<ActionResult>, after?: () => void) => {
    setNotice(null)
    start(async () => {
      const r = await fn()
      if (r.ok) {
        if (r.message) setNotice({ kind: 'ok', text: r.message })
        after?.()
      } else {
        setNotice({ kind: 'error', text: r.error })
      }
    })
  }
  return { pending, notice, act, clear: () => setNotice(null) }
}

export const busy = (pending: boolean) => (pending ? 'cursor-wait [&_*]:cursor-wait' : undefined)

/** A soft warm tint for errors (owner decision 9), plain words, never a code. */
export function StatusLine({ notice }: { notice: Notice }) {
  if (!notice) return null
  return notice.kind === 'error' ? (
    <p role="alert" className="rounded-lg border border-orange/40 bg-orange/15 px-3 py-2 text-sm text-ink">{notice.text}</p>
  ) : (
    <p role="status" className="text-sm text-muted-foreground">{notice.text}</p>
  )
}

export function PrimaryAction({ children, pending, pendingLabel = 'Working…', disabled, onClick, describedBy }: { children: ReactNode; pending?: boolean; pendingLabel?: string; disabled?: boolean; onClick: () => void; describedBy?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || pending} aria-describedby={describedBy} className="inline-flex h-11 items-center justify-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? pendingLabel : children}
    </button>
  )
}

export function SecondaryAction({ children, onClick, disabled, label, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; label?: string; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={label} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
      {children}
    </button>
  )
}

/** Two to four options as adjacent buttons (design principle 1). The selected one is ink, never the action color. */
export function ChoiceButtons<T extends string>({ label, options, value, onChange, disabled, size = 'md' }: { label: string; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; disabled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn('inline-flex items-center rounded-lg border font-semibold disabled:cursor-not-allowed disabled:opacity-60', size === 'md' ? 'h-10 px-5 text-sm' : 'px-3 py-1 text-xs', o.value === value ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Remove needs a second, explicit step, and the safe choice ("Keep it") is the one with focus. */
export function ConfirmRemove({ what, onConfirm, disabled }: { what: string; onConfirm: () => void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} aria-label={`Remove ${what}`} className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-ink disabled:opacity-60">
        Remove
      </button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-ink">Remove this {what}?</span>
      <button type="button" autoFocus onClick={() => setAsking(false)} className="rounded-md border border-border px-2 py-1 font-semibold text-ink">Keep it</button>
      <button
        type="button"
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
        className="rounded-md px-2 py-1 font-semibold text-ink underline underline-offset-4"
      >
        Yes, remove it
      </button>
    </span>
  )
}
