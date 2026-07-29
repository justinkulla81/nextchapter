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
}: {
  item: BenefitsActionItem
  completed: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => toggleBenefitsActionItem(item.id))}
      disabled={pending}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        completed ? 'border-success/40 bg-success/5' : 'border-border bg-white hover:border-brand/40',
        pending && 'cursor-progress opacity-70'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          completed ? 'border-success bg-success text-white' : 'border-muted-foreground/40'
        )}
        aria-hidden
      >
        {completed && <Check className="size-3.5" />}
      </span>
      <span className={cn('text-sm', completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
        {item.text}
      </span>
    </button>
  )
}
