'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const STOPS = [25, 50, 75, 100] as const

export function ConfidenceSlider({
  name,
  label,
  defaultValue,
  labels,
  suggestedValue,
}: {
  name: string
  label: string
  defaultValue: number | null
  labels: readonly [string, string, string, string]
  // Auto-fills the slider once, only while the candidate hasn't touched it
  // themselves — used to "tailor" this slider toward a value the candidate
  // already implied elsewhere on the page (e.g. picking a matching Superpower).
  suggestedValue?: number | null
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null)
  const [touched, setTouched] = useState(defaultValue !== null)

  useEffect(() => {
    if (!touched && suggestedValue != null) {
      // One-time adoption of an externally-derived suggestion, not a
      // derived-render loop — guarded by `touched` so it never fires again
      // once the candidate has made their own choice.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(suggestedValue)
    }
    // Only reacts to a fresh suggestion while untouched — deliberately
    // excludes `touched` so a later manual click doesn't get overwritten by
    // this effect re-running for an unrelated reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedValue])

  function select(stop: number) {
    setTouched(true)
    setValue(stop)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value ?? ''} />
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {STOPS.map((stop, i) => (
          <button
            key={stop}
            type="button"
            onClick={() => select(stop)}
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
