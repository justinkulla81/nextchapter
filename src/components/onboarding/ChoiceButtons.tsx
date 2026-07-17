'use client'

import { cn } from '@/lib/utils'

// Shared single-select button group — the one visual language ("border-2,
// brand accent when selected") every button-style choice in onboarding
// should use, so nothing reads as a different control by accident.
export function ChoiceButtons<T extends string>({
  name,
  options,
  value,
  onChange,
  columns,
}: {
  name: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  columns?: number
}) {
  return (
    <div>
      <input type="hidden" name={name} value={value ?? ''} />
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
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
            </button>
          )
        })}
      </div>
    </div>
  )
}
