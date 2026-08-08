import type { ReactNode } from 'react'
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

interface StatTileProps {
  value: ReactNode
  label: string
  accent?: StatTileAccent
  statusText?: string
  // When provided, the tile becomes a <details> disclosure — click the
  // tile to reveal this content (e.g. a per-item breakdown) below it.
  children?: ReactNode
  className?: string
  title?: string
}

// Shared "stat tile" shape for Dashboard and Network — one bordered box,
// a big number/value, a label, and a thin left accent bar that carries
// semantic color (good/on-pace/behind) without tinting the whole tile.
export function StatTile({ value, label, accent = 'neutral', statusText, children, className, title }: StatTileProps) {
  const head = (
    <div className="flex items-stretch">
      <div className={cn('w-[3px] shrink-0', ACCENT_BAR[accent])} aria-hidden="true" />
      <div className="flex-1 px-3.5 py-3">
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
        {statusText && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT_DOT[accent])} aria-hidden="true" />
            <span className="text-[11px] text-muted-foreground">{statusText}</span>
          </div>
        )}
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
