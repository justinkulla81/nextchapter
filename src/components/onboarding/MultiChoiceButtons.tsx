'use client'

import { cn } from '@/lib/utils'

// A multi-select sibling to ChoiceButtons. Design principles call for a
// dropdown at 5+ options, but a dropdown can't support a real "select
// several" interaction — a button/checkbox grid is the honest tradeoff here,
// same as other multi-select questions elsewhere in this codebase.
export function MultiChoiceButtons<T extends string>({
  name,
  options,
  value,
  onChange,
  columns,
  max,
}: {
  name: string
  options: readonly { value: T; label: string }[]
  value: T[]
  onChange: (value: T[]) => void
  columns?: number
  max?: number
}) {
  function toggle(opt: T) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt))
    } else {
      if (max !== undefined && value.length >= max) return
      onChange([...value, opt])
    }
  }

  return (
    <div>
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const isSelected = value.includes(opt.value)
          const isDisabled = !isSelected && max !== undefined && value.length >= max
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                'rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors',
                isSelected
                  ? 'border-brand bg-brand/5 text-brand'
                  : isDisabled
                    ? 'cursor-not-allowed border-border bg-off-white text-muted-foreground/50'
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
