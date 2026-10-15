'use client'

import { cn } from '@/lib/utils'

// Multi-select toggle buttons for a longer list of topics (single-select choices of
// 2-4 use ChoiceButtons). Each chip is a real button with aria-pressed.
export function ToggleChips({
  label,
  options,
  value,
  onChange,
  disabledValues = [],
}: {
  label: string
  options: readonly { value: string; label: string }[]
  value: string[]
  onChange: (next: string[]) => void
  /** Values that can't be picked right now (e.g. already chosen in the opposite list). */
  disabledValues?: string[]
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        const blocked = !on && disabledValues.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={blocked}
            title={blocked ? 'Already picked in the other list' : undefined}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              'rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors',
              on ? 'border-brand bg-brand/5 text-brand' : 'border-border bg-white text-foreground hover:border-brand/40',
              blocked && 'cursor-not-allowed opacity-50'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
