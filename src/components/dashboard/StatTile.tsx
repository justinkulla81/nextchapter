import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatTileAccent = 'success' | 'brand' | 'warning' | 'error' | 'neutral'

// Softer icon-badge coloring — a light tinted circle behind the icon,
// matching the reference design's colored-circle icon treatment on stat/
// summary cards. No side accent bar/dot — the tile's border does the
// framing, and any semantic color goes directly on the value text instead
// (see valueClassName) so a single glance carries the signal.
const ICON_BADGE: Record<StatTileAccent, string> = {
  success: 'bg-success/10 text-success',
  brand: 'bg-brand/10 text-brand',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  neutral: 'bg-muted text-muted-foreground',
}

interface StatTileProps {
  value: ReactNode
  label: string
  accent?: StatTileAccent
  // Overrides the value text's color class (e.g. 'text-success') — used
  // when the number itself needs to carry a good/bad signal, distinct from
  // the icon badge's accent.
  valueClassName?: string
  icon?: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  // When provided, the tile becomes a <details> disclosure — click the
  // tile to reveal this content (e.g. a per-item breakdown) below it.
  children?: ReactNode
  className?: string
  title?: string
}

// Shared "stat tile" shape for Dashboard and Network — one bordered box
// with a big number/value and a label underneath.
export function StatTile({ value, label, accent = 'neutral', valueClassName, icon: Icon, children, className, title }: StatTileProps) {
  const head = (
    <div className="flex items-start gap-2 px-3 py-2.5">
      {Icon && (
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', ICON_BADGE[accent])}>
          <Icon className="size-3" strokeWidth={2} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className={cn('text-lg font-bold tabular-nums text-foreground', valueClassName)}>{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )

  if (children) {
    return (
      <details className={cn('overflow-hidden rounded-lg border border-border', className)} title={title}>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{head}</summary>
        <div className="border-t border-border px-3.5 py-3">{children}</div>
      </details>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)} title={title}>
      {head}
    </div>
  )
}
