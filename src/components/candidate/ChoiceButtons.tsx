'use client'

import { cn } from '@/lib/utils'

export interface ChoiceOption {
  value: string
  label: string
}

// Two to four choices, side by side. Each is a real radio input under a button-shaped label, so it submits
// with a plain <form> (no scripts needed), is keyboard-reachable with the arrow keys, and has a visible focus ring.
// Pass `value` and `onChange` to control it, or `defaultValue` to leave it to the form.
export function ChoiceButtons({
  name,
  label,
  options,
  value,
  defaultValue,
  onChange,
  required,
  className,
}: {
  name: string
  /** The accessible name of the group, usually the question. */
  label: string
  options: readonly ChoiceOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  required?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o, i) => (
        <label
          key={o.value}
          className="inline-flex h-10 cursor-pointer items-center rounded-full border border-border px-5 text-sm font-medium text-ink select-none hover:bg-muted has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:hover:bg-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/40"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            className="sr-only"
            required={required && i === 0}
            {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
            onChange={() => onChange?.(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}
