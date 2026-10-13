'use client'

import posthog from 'posthog-js'
import { GRAD_ROI_ALTERNATIVES, GRAD_ROI_FACTS } from '@/lib/outcomes/grad-roi'

// Neutral, sourced guardrail for people weighing a master's or MBA to change
// fields. Collapsed by default so it informs without nagging.
export function GradDegreeGuardrailCard() {
  return (
    <details
      className="rounded-lg border border-border bg-card p-4"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('grad_roi_guardrail_opened')
      }}
    >
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Thinking about a master&apos;s or MBA to change fields? Check these first
      </summary>
      <div className="mt-3 space-y-4 text-sm">
        <ul className="space-y-3">
          {GRAD_ROI_FACTS.map((f) => (
            <li key={f.text}>
              <p className="text-foreground">{f.text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Source: {f.source}</p>
            </li>
          ))}
        </ul>
        <div>
          <p className="font-medium text-foreground">Lower-cost routes to try first</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {GRAD_ROI_ALTERNATIVES.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          This is general information, not financial advice. Returns depend on the program, the field, and whether you finish.
        </p>
      </div>
    </details>
  )
}
