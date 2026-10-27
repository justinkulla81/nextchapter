'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { JOURNEY_TO_SITUATION } from '@/lib/constants/onboarding'
import { ONBOARDING_GROUPS, onboardingGroupOfJourney, type OnboardingGroupKey } from '@/lib/constants/journey-groups'
import { journeyOfSituation, type Option } from '@/lib/onboarding/bundles'
import { usePostHog } from '@/lib/posthog/client'

// "Which of these sounds most like you?", as two short screens instead of twelve cards at once: first where you are
// (four broad answers), then the one that fits within it (two to four cards). The saved answer is the same situation
// key as before, so nothing downstream changes. A card already chosen elsewhere (the homepage picker, a /start page)
// opens straight on its own group with the card marked, so they only confirm. Picking a card is firm: the old
// "pick again to clear" made people think the choice had not registered (about seven answers per person in the first month).
export function SituationCards({ legend, options, value, onChange }: { legend: string; options: readonly Option[]; value: string; onChange: (v: string) => void }) {
  const posthog = usePostHog()
  const chosenJourney = journeyOfSituation(value)
  const [picked, setPicked] = useState<OnboardingGroupKey | null>(null)
  const group = ONBOARDING_GROUPS.find((g) => g.key === picked) ?? onboardingGroupOfJourney(chosenJourney)
  // Legacy keys ('just_resigned', 'ready_to_move') stand for a journey too: mark that journey's card, keep the saved key.
  const markedValue = chosenJourney ? JOURNEY_TO_SITUATION[chosenJourney] : ''

  const back = () => {
    posthog?.capture('onboarding_group_changed', { bundleId: 'where_you_are', from: group?.key })
    setPicked(null)
    onChange('')
  }

  if (!group) {
    return (
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-ink">Where are you right now?</legend>
        <input type="hidden" name="situation" value="" />
        <div className="grid gap-3 sm:grid-cols-2">
          {ONBOARDING_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                setPicked(g.key)
                posthog?.capture('onboarding_group_selected', { bundleId: 'where_you_are', group: g.key })
              }}
              className="space-y-1 rounded-2xl border border-border bg-white p-4 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
            >
              <span className="block text-base font-semibold text-ink">{g.label}</span>
              <span className="block text-sm text-muted-foreground">{g.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  const shown = options.filter((o) => {
    const j = journeyOfSituation(o.value)
    return !!j && group.journeys.includes(j)
  })

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{legend}</legend>
      <input type="hidden" name="situation" value={value} />
      <p className="text-sm text-muted-foreground">{group.label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((o) => {
          const on = markedValue === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
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
      <button type="button" onClick={back} className="text-sm text-muted-foreground underline underline-offset-4">
        None of these: change where I am
      </button>
    </fieldset>
  )
}
