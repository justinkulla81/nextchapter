import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The one visual treatment for any question whose answer personalizes what the
 * user sees. It is deliberately louder than body copy: a "Personalize" tag says
 * what the question is for, the question is the largest text in the block, and
 * a "What you get" line states the payoff so answering feels worth the effort.
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
  children,
  className,
}: {
  id: string
  question: React.ReactNode
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
        'space-y-3 rounded-xl border-2 border-foreground/20 bg-card p-4 shadow-sm sm:p-6',
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
      </div>
      <h3 id={`${id}-question`} className="text-base font-semibold leading-snug text-foreground sm:text-lg">
        {question}
      </h3>
      <p className="text-sm text-foreground">
        <span className="font-semibold">What you get: </span>
        {payoff}
      </p>
      {children}
    </section>
  )
}
