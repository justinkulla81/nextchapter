import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Change, SharedRow } from '@/lib/coach/prep/types'

// Small pieces of the session prep page, taken from the approved mockup (dev-preview coach-session.tsx).

export const Why = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">Why: {children}</p>

export const PrepCard = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('rounded-2xl border border-border p-5', className)}>{children}</div>

/** A section that could not be filled says so in plain words and what to do, instead of disappearing. */
export const Unavailable = ({ children }: { children: ReactNode }) => <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{children}</p>

export function ChangeRow({ change }: { change: Change }) {
  const Icon = change.dir === 'up' ? ArrowUp : change.dir === 'down' ? ArrowDown : Sparkles
  return (
    <li className="flex items-start gap-2 text-sm text-ink">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink/70" aria-hidden />
      <span>{change.text}</span>
    </li>
  )
}

export function SharedItem({ row }: { row: SharedRow }) {
  return (
    <li className="flex items-start gap-2.5 py-2 text-sm">
      {row.shared ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className={row.shared ? 'text-ink' : 'text-muted-foreground'}>
        {row.label}
        <span className="sr-only">{row.shared ? ' (shared with you)' : ' (not shared with you)'}</span>
        {row.note && <span className="block text-xs text-muted-foreground">{row.note}</span>}
      </span>
    </li>
  )
}
