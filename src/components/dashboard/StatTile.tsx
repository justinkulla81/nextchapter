import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatTileAccent = 'success' | 'brand' | 'warning' | 'error' | 'neutral'

const ACCENT_BAR: Record<StatTileAccent, string> = {
  success: 'bg-success',
  brand: 'bg-brand',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-border',
}

const ACCENT_DOT: Record<StatTileAccent, string> = {
  success: 'bg-success',
  brand: 'bg-brand',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-gray',
}

// Softer, icon-badge coloring than the accent bar/dot above — a light
// tinted circle behind the icon, matching the reference design's colored-
// circle icon treatment on stat/summary cards.
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
  statusText?: string
  icon?: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  // When provided, the tile becomes a <details> disclosure — click the
  // tile to reveal this content (e.g. a per-item breakdown) below it.
  children?: ReactNode
  className?: string
  title?: string
}

// Shared "stat tile" shape for Dashboard and Network — one bordered box,
// a big number/value, a label, and a thin left accent bar that carries
// semantic color (good/on-pace/behind) without tinting the whole tile.
export function StatTile({ value, label, accent = 'neutral', statusText, icon: Icon, children, className, title }: StatTileProps) {
  const head = (
    <div className="flex items-stretch">
      <div className={cn('w-[3px] shrink-0', ACCENT_BAR[accent])} aria-hidden="true" />
      <div className="flex flex-1 items-start gap-2 px-3 py-2.5">
        {Icon && (
          <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', ICON_BADGE[accent])}>
            <Icon className="size-3" strokeWidth={2} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
          {statusText && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT_DOT[accent])} aria-hidden="true" />
              <span className="text-[11px] text-muted-foreground">{statusText}</span>
            </div>
          )}
        </div>
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
