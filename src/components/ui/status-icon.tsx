import { Check, X, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

// Prompt 66 — the one status icon set, used everywhere a status is shown:
// ✓ success/no-issues, ✗ issue found, 🔒 locked/gated. Exact colors tied to
// the existing design tokens (--color-success/--color-error/--color-orange
// in globals.css), not new hex values. Nothing in the codebase used a
// check/x icon language before this — badges used emoji, fit used color
// pills, reports used plain text — so this is a net-new shared primitive,
// not a replacement for a conflicting old one in most call sites.
export type StatusIconStatus = 'success' | 'error' | 'locked'

const ICON: Record<StatusIconStatus, typeof Check> = {
  success: Check,
  error: X,
  locked: Lock,
}

const COLOR: Record<StatusIconStatus, string> = {
  success: 'text-success',
  error: 'text-error',
  locked: 'text-orange',
}

export function StatusIcon({
  status,
  className,
  size = 16,
}: {
  status: StatusIconStatus
  className?: string
  size?: number
}) {
  const Icon = ICON[status]
  return <Icon className={cn(COLOR[status], className)} size={size} aria-hidden="true" />
}

// Icon + short label row — the "each category/section as a row with the
// icon and a short label" pattern, not a wall of text or a one-off
// treatment per surface. sublabel is optional secondary text (e.g. an
// unlock condition) shown under the label.
export function StatusRow({
  status,
  label,
  sublabel,
  className,
}: {
  status: StatusIconStatus
  label: string
  sublabel?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <StatusIcon status={status} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  )
}
