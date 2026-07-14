'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const STOPS = [25, 50, 75, 100] as const

export function ConfidenceSlider({
  name,
  label,
  defaultValue,
  labels,
}: {
  name: string
  label: string
  defaultValue: number | null
  labels: readonly [string, string, string, string]
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value ?? ''} />
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {STOPS.map((stop, i) => (
          <button
            key={stop}
            type="button"
            onClick={() => setValue(stop)}
            aria-pressed={value === stop}
            className={cn(
              'rounded-lg border-2 p-2 text-center text-[11px] leading-snug font-medium transition-colors sm:p-3 sm:text-sm',
              value === stop
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-border bg-white text-foreground hover:border-brand/40'
            )}
          >
            {labels[i]}
          </button>
        ))}
      </div>
    </div>
  )
}
