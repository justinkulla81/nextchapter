'use client'

import { buttonVariants } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

/** The event the "Yes" button sends to the questions below it, so they open already answered (see SituationFlow). */
export const AFFECTED_EVENT = 'nc:affected-yes'

/**
 * The hero's primary action. It scrolls to the questions and, when "yes" settles question 1 (laid off, or offered the buyout),
 * answers it there, so the visitor lands on question 2 with their first-week steps already waiting instead of on a blank first question.
 */
export function AffectedYes({ label, preselect, properties }: { label: string; preselect: boolean; properties: Record<string, unknown> }) {
  return (
    <a
      href="#where-you-stand"
      onClick={() => {
        posthog.capture('layoff_affected_clicked', properties)
        if (preselect) window.dispatchEvent(new CustomEvent(AFFECTED_EVENT))
      }}
      className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
    >
      {label}
    </a>
  )
}
