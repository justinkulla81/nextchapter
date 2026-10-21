'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/app/dashboard/in-work/actions'

// The workspace's seven tabs share these building blocks: reading-size text, serif titles, ink instead of blue.

// Text sizes for the tab bodies.
export function useType() {
  return {
    /** Body copy and list rows. */
    body: 'text-base',
    /** Hints, notes and meta lines. */
    hint: 'text-base',
    /** Dates and other tiny facts. */
    meta: 'text-sm',
  }
}

// A tab's buttons: a quiet ink-outlined pill, because the page's one orange action is "Log a win" in its header.
export function ActionButton({ variant, size: _size, className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant={variant === 'ghost' ? 'ghost' : 'outline'} className={cn('h-10 rounded-full px-5 text-sm', className)} {...props} />
}

export type Notice = { kind: 'ok' | 'error'; text: string } | null

// Runs a server action with the busy state and a visible result. The caller
// keeps its own form state, so nothing is cleared when an action fails.
export function useRunner() {
  const [pending, start] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)
  function run<T extends object>(fn: () => Promise<ActionResult<T>>, okText: string, after?: (r: Extract<ActionResult<T>, { ok: true }>) => void) {
    setNotice(null)
    start(async () => {
      try {
        const r = await fn()
        if (r.ok) {
          setNotice({ kind: 'ok', text: okText })
          after?.(r as Extract<ActionResult<T>, { ok: true }>)
        } else {
          setNotice({ kind: 'error', text: r.error })
        }
      } catch {
        setNotice({ kind: 'error', text: 'Something went wrong. Your entries are still here. Try again.' })
      }
    })
  }
  return { pending, notice, setNotice, run }
}

export function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <p role="status" className={cn('text-base', notice.kind === 'ok' ? 'font-medium text-ink' : 'text-destructive')}>
      {notice.text}
    </p>
  )
}

export function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        {intro && <p className="max-w-2xl text-base text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const t = useType()
  return (
    <label className="block space-y-1">
      <span className="text-base font-medium text-ink">{label}</span>
      {children}
      {hint && <span className={cn('block text-muted-foreground', t.hint)}>{hint}</span>}
    </label>
  )
}

export const selectClass =
  'h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand md:text-sm'

// Adjacent buttons for 2 to 4 choices (design-principles.md).
export function ChoiceButtons<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly { key: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            value === o.key ? 'border-ink bg-ink/5 font-semibold text-ink' : 'border-border bg-background text-foreground/80 hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CopyBlock({ text, label, onCopy }: { text: string; label: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-2">
      <pre className="max-h-96 max-w-2xl overflow-auto rounded-2xl border border-border p-5 font-sans text-base whitespace-pre-wrap text-ink">{text}</pre>
      <button
        type="button"
        className="h-10 rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            onCopy?.()
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? 'Copied' : label}
      </button>
    </div>
  )
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Two-step delete: the first click asks, the second confirms.
export function ConfirmDelete({ onConfirm, pending, what }: { onConfirm: () => void; pending?: boolean; what: string }) {
  const [asking, setAsking] = useState(false)
  const t = useType()
  if (!asking) {
    return (
      <button type="button" className={cn('font-medium text-muted-foreground hover:text-destructive', t.meta)} onClick={() => setAsking(true)}>
        Delete
      </button>
    )
  }
  return (
    <span className={cn('flex items-center gap-2', t.meta)}>
      <span className="text-muted-foreground">Delete this {what}?</span>
      <button type="button" disabled={pending} className="font-semibold text-destructive" onClick={onConfirm}>
        Yes, delete
      </button>
      <button type="button" className="font-medium text-muted-foreground" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  )
}
