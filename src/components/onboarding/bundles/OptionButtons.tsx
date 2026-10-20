'use client'

import { cn } from '@/lib/utils'
import type { Option } from '@/lib/onboarding/bundles'

// Two to four options sit side by side as buttons (design-principles.md). Five or more are a dropdown instead,
// and the situation cards are their own larger layout (SituationCards). Selected is shown with the border and a
// tint, not the orange action color, which is kept for the one thing to do next.
export function OptionButtons({ legend, help, options, value, onChange, name }: { legend: string; help?: string; options: readonly Option[]; value: string; onChange: (v: string) => void; name: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold text-ink">{legend}</legend>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : o.value)}
              className={cn(
                'rounded-full border px-5 py-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                on ? 'border-ink bg-muted font-semibold text-ink' : 'border-border bg-white text-ink hover:bg-muted/60',
              )}
            >
              {o.label}
              {o.hint && <span className="block text-xs font-normal text-muted-foreground">{o.hint}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
