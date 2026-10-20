'use client'

import { useId } from 'react'
import { controlFor } from '@/lib/redesign/choice'
import { ChoiceButtons, type ChoiceOption } from './ChoiceButtons'

// One question with one answer. Two to four options render as adjacent buttons; five or more as a dropdown
// (design-principles.md). The question is always visible text, with an optional line saying why we ask.
export function ChoiceField({
  name,
  label,
  why,
  options,
  value,
  defaultValue,
  onChange,
  required,
  placeholder = 'Choose one',
}: {
  name: string
  label: string
  why?: string
  options: readonly ChoiceOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  required?: boolean
  placeholder?: string
}) {
  const id = useId()
  const control = controlFor(options.length)
  return (
    <div className="space-y-2">
      {control === 'dropdown' ? (
        <label htmlFor={id} className="block text-base font-semibold text-ink">
          {label}
        </label>
      ) : (
        <p className="text-base font-semibold text-ink">{label}</p>
      )}
      {why && <p className="text-sm text-muted-foreground">{why}</p>}
      {control === 'buttons' ? (
        <ChoiceButtons name={name} label={label} options={options} value={value} defaultValue={defaultValue} onChange={onChange} required={required} />
      ) : (
        <select
          id={id}
          name={name}
          required={required}
          className="h-11 w-full max-w-sm rounded-xl border border-border bg-white px-3.5 text-base text-ink"
          {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? '' })}
          onChange={(e) => onChange?.(e.target.value)}
        >
          <option value="" disabled={required}>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
