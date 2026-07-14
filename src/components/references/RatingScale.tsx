'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// One neutral style for every point — the number isn't a value judgment, so
// no point should read as visually "better" or "worse" than another.
const SELECTED_STYLE = 'border-brand bg-brand text-white'
const HOVER_STYLE = 'hover:border-brand/50 hover:bg-brand/5'

export function RatingScale({
  name,
  label,
  lowLabel = 'Strongly disagree',
  highLabel = 'Strongly agree',
  id,
  onAnswered,
  highlighted,
}: {
  name: string
  label: string
  lowLabel?: string
  highLabel?: string
  id?: string
  onAnswered?: () => void
  highlighted?: boolean
}) {
  const [value, setValue] = useState<number | null>(null)

  return (
    <fieldset
      id={id}
      className={cn(
        'space-y-3 rounded-xl border border-border bg-off-white p-4 transition-shadow',
        highlighted && 'border-destructive ring-2 ring-destructive/40'
      )}
    >
      <legend className="text-lg leading-snug text-foreground">{label}</legend>
      <div className="flex justify-between gap-1 sm:gap-2">
        {[1, 2, 3, 4, 5].map((point) => {
          const isSelected = value === point
          return (
            <label key={point} className="flex flex-1 cursor-pointer flex-col items-center gap-1">
              <input
                type="radio"
                name={name}
                value={point}
                onChange={() => {
                  setValue(point)
                  onAnswered?.()
                }}
                className="peer sr-only"
                required
              />
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold transition-colors sm:size-14 sm:text-xl',
                  isSelected ? SELECTED_STYLE : cn('border-border bg-white text-foreground', HOVER_STYLE)
                )}
              >
                {point}
              </span>
            </label>
          )
        })}
      </div>
      <div className="flex justify-between text-sm font-medium text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  )
}
