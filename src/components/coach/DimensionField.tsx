'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  SESSION_DIMENSION_DESCRIPTION,
  SESSION_DIMENSION_LABEL,
  SESSION_DIMENSION_STATUSES,
  SESSION_DIMENSION_STATUS_LABEL,
  SESSION_DIMENSION_TRENDS,
  SESSION_DIMENSION_TREND_LABEL,
  dimensionFieldName,
  type SessionDimensionKey,
} from '@/lib/coach/session-dimensions'
import type { SessionDimensionStatus, SessionDimensionTrend } from '@prisma/client'

// design-principles.md: 2-4 discrete options render as adjacent buttons, not
// a dropdown — status and trend are each a fixed 3-value scale, so both use
// this small radio-as-buttons group rather than a <select>.
function OptionGroup<T extends string>({
  name,
  options,
  labels,
  value,
  onChange,
}: {
  name: string
  options: T[]
  labels: Record<T, string>
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt
        return (
          <label key={opt} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              checked={selected}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            <span
              className={cn(
                'inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors',
                selected
                  ? 'border-brand bg-brand text-white'
                  : 'border-input bg-background text-foreground hover:border-brand/50'
              )}
            >
              {labels[opt]}
            </span>
          </label>
        )
      })}
    </div>
  )
}

// One dimension's full triad (status, trend, note) for the session-logging
// form — §A5.1. Uncontrolled as far as the parent form is concerned (plain
// radio/textarea `name`s, read via FormData on submit, same as the rest of
// LogSessionForm); the useState here only drives the selected-button visual.
export function DimensionField({ dimensionKey }: { dimensionKey: SessionDimensionKey }) {
  const [status, setStatus] = useState<SessionDimensionStatus | null>(null)
  const [trend, setTrend] = useState<SessionDimensionTrend | null>(null)

  return (
    <fieldset className="space-y-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium text-foreground">{SESSION_DIMENSION_LABEL[dimensionKey]}</legend>
      <p className="text-xs text-muted-foreground">{SESSION_DIMENSION_DESCRIPTION[dimensionKey]}</p>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <OptionGroup
          name={dimensionFieldName(dimensionKey, 'status')}
          options={SESSION_DIMENSION_STATUSES}
          labels={SESSION_DIMENSION_STATUS_LABEL}
          value={status}
          onChange={setStatus}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Trend</Label>
        <OptionGroup
          name={dimensionFieldName(dimensionKey, 'trend')}
          options={SESSION_DIMENSION_TRENDS}
          labels={SESSION_DIMENSION_TREND_LABEL}
          value={trend}
          onChange={setTrend}
        />
      </div>

      <Textarea
        name={dimensionFieldName(dimensionKey, 'note')}
        placeholder="Optional note for this dimension"
        rows={2}
        className="text-sm"
      />
    </fieldset>
  )
}
