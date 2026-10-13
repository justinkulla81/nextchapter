'use client'

import { useActionState, useState } from 'react'
import { updateJourney } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { JOURNEYS, MOVE_DRIVERS, STAGES, getJourney, type JourneyStage, type JourneyType, type MoveDriver } from '@/lib/journey/journey'

// "Your situation" on Privacy: why you're moving and how close you are to
// applying. Your plan and check-ins follow both.
export function JourneySelector({ journey, stage, moveDriver }: { journey: JourneyType | null; stage: JourneyStage | null; moveDriver: MoveDriver | null }) {
  const [state, formAction, pending] = useActionState(updateJourney, undefined)
  const [j, setJ] = useState<JourneyType>(journey ?? 'EXPLORING_MOVE')
  const [s, setS] = useState<JourneyStage>(stage ?? getJourney(journey ?? 'EXPLORING_MOVE').defaultStage)
  const [d, setD] = useState<MoveDriver | null>(moveDriver)
  const unchanged = j === journey && s === stage && (j !== 'EXPLORING_MOVE' || d === moveDriver)

  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="journey-select">What&apos;s going on</Label>
          <select
            id="journey-select"
            name="journey"
            value={j}
            onChange={(e) => setJ(e.target.value as JourneyType)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {JOURNEYS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stage-select">Where you are</Label>
          <select
            id="stage-select"
            name="stage"
            value={s}
            onChange={(e) => setS(e.target.value as JourneyStage)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {STAGES.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}: {x.plan}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton size="sm" variant="outline" disabled={unchanged} title={unchanged ? 'Change one of these to save' : undefined}>
          Save situation
        </SubmitButton>
      </div>
      {j === 'EXPLORING_MOVE' && (
        <div className="space-y-1.5">
          <Label>What&apos;s behind the move?</Label>
          <ChoiceButtons
            name="moveDriver"
            options={MOVE_DRIVERS.map((x) => ({ value: x.key, label: x.label }))}
            value={d}
            onChange={setD}
            columns={3}
            responsive
          />
        </div>
      )}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
