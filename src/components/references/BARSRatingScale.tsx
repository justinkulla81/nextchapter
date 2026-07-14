'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Anchor {
  scalePoint: number
  anchorText: string
}

export function BARSRatingScale({
  dimension,
  dimensionLabel,
  anchors,
}: {
  dimension: string
  dimensionLabel: string
  anchors: Anchor[]
}) {
  const [value, setValue] = useState<number | null>(null)
  const sorted = [...anchors].sort((a, b) => a.scalePoint - b.scalePoint)

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{dimensionLabel}</legend>
      <div className="space-y-2">
        {sorted.map((anchor) => (
          <label
            key={anchor.scalePoint}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
              value === anchor.scalePoint ? 'border-primary bg-primary/5' : 'border-border'
            )}
          >
            <input
              type="radio"
              name={`barsScore-${dimension}`}
              value={anchor.scalePoint}
              onChange={() => setValue(anchor.scalePoint)}
              className="sr-only"
              required
            />
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                value === anchor.scalePoint
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground'
              )}
            >
              {anchor.scalePoint}
            </span>
            <span className="text-sm text-muted-foreground">{anchor.anchorText}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
