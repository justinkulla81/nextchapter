'use client'

import { useId } from 'react'
import { normalizeHex } from '@/lib/partners/brand'

const input = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

// Any color, not a short list: the system color picker, a hex box for exact
// brand colors, and optional quick picks. Empty means "use the default".
export function ColorField({
  label,
  hint,
  name,
  value,
  onChange,
  swatches,
  fallback = '#1d6fb8',
}: {
  label: string
  hint?: string
  name: string
  value: string
  onChange: (next: string) => void
  swatches?: readonly string[]
  /** What the picker shows before a color is chosen. */
  fallback?: string
}) {
  const id = useId()
  const norm = value ? normalizeHex(value) : null
  const invalid = !!value && !norm
  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-hex`} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}, pick a color`}
          value={norm ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <input
          id={`${id}-hex`}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1d6fb8"
          maxLength={7}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          className={input}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <p id={`${id}-help`} className={`text-xs ${invalid ? 'text-destructive' : 'text-muted-foreground'}`}>
        {invalid ? 'Use six characters, like #1d6fb8.' : hint ?? 'Pick any color, or type an exact hex code.'}
      </p>
      {swatches && swatches.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${label}, quick picks`}>
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Use ${c}`}
              aria-pressed={value.toLowerCase() === c}
              className={`size-7 rounded-md border-2 ${value.toLowerCase() === c ? 'border-foreground' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
