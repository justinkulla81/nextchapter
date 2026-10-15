'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { PersonalizationQuestion } from '@/components/ui/personalization-question'
import { PEOPLE_ENERGY_OPTIONS, type PeopleEnergy } from '@/lib/pivots/scoring'
import { savePeopleEnergy } from '@/app/dashboard/pivot-paths/actions'

/**
 * One optional question that tilts pivot suggestions toward people-heavy or
 * focused work. Three adjacent buttons; the answer is saved as given.
 */
export function PeopleEnergyQuestion({ current, source }: { current: PeopleEnergy | null; source: 'answer' | 'assessment' | null }) {
  const [selected, setSelected] = useState<PeopleEnergy | null>(source === 'answer' ? current : null)
  const [note, setNote] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(answer: PeopleEnergy) {
    const previous = selected
    setSelected(answer)
    setNote(null)
    posthog.capture('pivot_personality_answered', { answer, previous: previous ?? current ?? null, priorSource: source })
    startTransition(async () => {
      const saved = await savePeopleEnergy(answer)
      if (!saved.ok) {
        setSelected(previous)
        setNote(saved.error)
      } else {
        setNote('Saved. Your paths are re-ranked.')
      }
    })
  }

  const assessmentLabel = source === 'assessment' && current ? PEOPLE_ENERGY_OPTIONS.find((o) => o.value === current)?.label : null

  return (
    <PersonalizationQuestion
      id="people-energy"
      question="How much people contact do you want in your next job?"
      payoff="Your paths re-rank right away toward people-heavy roles (like sales) or focused roles (like analytics), so the top of this list fits how you want to work."
      optional={!assessmentLabel}
      pending={pending}
    >
      {assessmentLabel && (
        <p className="text-sm text-muted-foreground">
          {`From your How I Work Best answers we read: "${assessmentLabel.toLowerCase()}". Change it here if that's not right.`}
        </p>
      )}
      <div role="group" aria-label="How much people contact you want" className="flex flex-wrap gap-2">
        {PEOPLE_ENERGY_OPTIONS.map((o) => {
          const on = selected === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              aria-pressed={on}
              aria-busy={pending}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted',
                pending && 'cursor-wait'
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {note && (
        <p role="status" className="text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </PersonalizationQuestion>
  )
}
