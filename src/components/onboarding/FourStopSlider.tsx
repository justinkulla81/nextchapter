'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function FourStopSlider({
  name,
  choices,
  defaultValue,
  onChange,
}: {
  name: string
  choices: readonly { value: number; label: string }[]
  defaultValue: number | null
  onChange?: (value: number) => void
}) {
  const defaultIndex =
    defaultValue === null
      ? 0
      : choices.reduce(
          (closest, c, i) =>
            Math.abs(c.value - defaultValue) < Math.abs(choices[closest].value - defaultValue) ? i : closest,
          0
        )
  const [index, setIndex] = useState(defaultIndex)

  function select(i: number) {
    setIndex(i)
    onChange?.(choices[i].value)
  }

  return (
    <div>
      <input type="hidden" name={name} value={choices[index].value} />
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {choices.map((choice, i) => {
          const isSelected = i === index
          return (
            <button
              key={choice.value}
              type="button"
              onClick={() => select(i)}
              aria-pressed={isSelected}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-2 text-center transition-colors sm:p-3',
                isSelected ? 'border-brand bg-brand/5' : 'border-border bg-white hover:border-brand/40'
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isSelected
                    ? 'bg-brand text-white'
                    : i < index
                      ? 'bg-brand/20 text-brand'
                      : 'bg-light-gray text-muted-foreground'
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'text-[11px] leading-snug sm:text-sm',
                  isSelected ? 'font-semibold text-brand' : 'text-muted-foreground'
                )}
              >
                {choice.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
