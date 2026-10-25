import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The one visual treatment for any question whose answer personalizes what the
 * user sees. It matches ChoiceField (the redesign's question pattern): the
 * question is semibold ink text, with a quiet line saying what answering gets
 * you. A small "Personalize" tag says what the question is for. No card or
 * border: the page contract allows one headline, one action, few boxes.
 *
 * Neutral (foreground) colors on purpose — the accent color stays reserved for
 * the answer buttons inside, which are the actionable part.
 */
export function PersonalizationQuestion({
  id,
  question,
  payoff,
  optional = false,
  pending = false,
  htmlFor,
  badge,
  children,
  className,
}: {
  id: string
  question: React.ReactNode
  /** Id of the single input this question labels (select, text field); omit for button groups. */
  htmlFor?: string
  /** Extra status next to the tag, e.g. a "Not answered yet" flag. */
  badge?: React.ReactNode
  /** What the user gets for answering, in plain words ("Your paths re-rank toward…"). */
  payoff: React.ReactNode
  optional?: boolean
  pending?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={`${id}-question`}
      className={cn(
        'space-y-2',
        pending && 'cursor-wait',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
          <SlidersHorizontal className="size-3" aria-hidden="true" />
          Personalize
        </span>
        {optional && <span className="text-xs text-muted-foreground">Optional, takes a few seconds</span>}
        {badge}
      </div>
      <h3 id={`${id}-question`} className="text-base font-semibold leading-snug text-ink">
        {htmlFor ? <label htmlFor={htmlFor}>{question}</label> : question}
      </h3>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">What you get: </span>
        {payoff}
      </p>
      {children}
    </section>
  )
}
