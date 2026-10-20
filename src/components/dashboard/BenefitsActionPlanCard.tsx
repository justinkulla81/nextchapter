'use client'

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { toggleBenefitsActionItem } from '@/app/dashboard/benefits/actions'
import { cn } from '@/lib/utils'
import type { BenefitsActionItem } from '@/lib/benefits/action-plan'

// Prompt 72 — the checkable-card pattern matching the Weekly Search Sprint
// checkbox rows and the status-icon language from Prompts 66-67. No points
// are awarded here — this is plain completion tracking on the candidate's
// own financial-pressure action plan, not a Search Action.
export function BenefitsActionPlanCard({
  item,
  completed,
  redesign = false,
}: {
  item: BenefitsActionItem
  completed: boolean
  /** The redesigned look: a row you tick off, at body size, without the green wash on done items. */
  redesign?: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => toggleBenefitsActionItem(item.id))}
      disabled={pending}
      aria-pressed={completed}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors',
        redesign ? 'rounded-2xl border border-border p-4 hover:bg-muted/50' : 'rounded-lg border p-3',
        !redesign && (completed ? 'border-success/40 bg-success/5' : 'border-border bg-white hover:border-brand/40'),
        pending && 'cursor-progress opacity-70'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          completed ? (redesign ? 'border-ink bg-ink text-white' : 'border-success bg-success text-white') : 'border-muted-foreground/40'
        )}
        aria-hidden
      >
        {completed && <Check className="size-3.5" />}
      </span>
      <span className={cn(redesign ? 'text-base' : 'text-sm', completed ? 'text-muted-foreground line-through' : redesign ? 'text-ink' : 'text-foreground')}>
        {item.text}
      </span>
    </button>
  )
}
