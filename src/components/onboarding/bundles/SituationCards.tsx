'use client'

import { cn } from '@/lib/utils'
import type { Option } from '@/lib/onboarding/bundles'

// The eleven "which sounds like you" cards: each is a title and one line, so they are cards rather than a
// dropdown (the mockup at /dev-preview/moments/onboarding). Picking one again clears it.
export function SituationCards({ legend, options, value, onChange }: { legend: string; options: readonly Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{legend}</legend>
      <input type="hidden" name="situation" value={value} />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : o.value)}
              className={cn(
                'space-y-1 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                on ? 'border-ink bg-muted/60' : 'border-border bg-white hover:bg-muted/40',
              )}
            >
              <span className="block text-base font-semibold text-ink">{o.label}</span>
              {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
