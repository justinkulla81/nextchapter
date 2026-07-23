'use client'

import { cn } from '@/lib/utils'

// One column on narrow screens regardless of desktop column count, so a
// multi-column choice never sits stacked-then-cramped — only literal class
// names here since Tailwind can't resolve an interpolated template string.
const RESPONSIVE_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-5',
}

// Shared single-select button group — the one visual language ("border-2,
// brand accent when selected") every button-style choice in onboarding
// should use, so nothing reads as a different control by accident.
export function ChoiceButtons<T extends string>({
  name,
  options,
  value,
  onChange,
  columns,
  responsive,
}: {
  name: string
  options: readonly { value: T; label: string; subtext?: string }[]
  value: T | null
  onChange: (value: T) => void
  columns?: number
  // Opt-in only, so every existing call site keeps its exact current
  // (non-responsive, inline-style) grid behavior unless it asks for this.
  responsive?: boolean
}) {
  const resolvedColumns = columns ?? options.length
  return (
    <div>
      <input type="hidden" name={name} value={value ?? ''} />
      <div
        className={cn('grid gap-2', responsive && RESPONSIVE_GRID_COLS[resolvedColumns])}
        style={responsive ? undefined : { gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                'rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors',
                isSelected
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {opt.label}
              {opt.subtext && (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {opt.subtext}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
