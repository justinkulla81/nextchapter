'use client'

import { useActionState, useState } from 'react'
import { updateJourney } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { INTENSITY_OPTIONS } from '@/lib/journey/intensity'
import { situationFieldsFor } from '@/lib/journey/situation'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { ACTIVE_SEARCH_STAGES, JOURNEYS, MOVE_DRIVERS, STAGES, getJourney, getStage, type JourneyStage, type JourneyType, type MoveDriver } from '@/lib/journey/journey'

// "Your situation" on Privacy: why you're moving and how close you are to
// applying. Your plan and check-ins follow both.
export function JourneySelector({
  journey,
  stage,
  moveDriver,
  intensity,
  details,
}: {
  journey: JourneyType | null
  stage: JourneyStage | null
  moveDriver: MoveDriver | null
  intensity: string | null
  details: { returnDate: string; offering: string; openDays: string; engagementEnds: string; venture: string; situation: Record<string, string> }
}) {
  const [state, formAction, pending] = useActionState(updateJourney, undefined)
  const [j, setJ] = useState<JourneyType>(journey ?? 'EXPLORING_MOVE')
  const [s, setS] = useState<JourneyStage>(stage ?? getJourney(journey ?? 'EXPLORING_MOVE').defaultStage)
  const [d, setD] = useState<MoveDriver | null>(moveDriver)
  const [i, setI] = useState<string | null>(intensity === 'ACTIVELY_SEARCHING' ? 'ACTIVELY_SEARCHING' : intensity ? 'CASUALLY_LOOKING' : null)
  const initialI = intensity === 'ACTIVELY_SEARCHING' ? 'ACTIVELY_SEARCHING' : intensity ? 'CASUALLY_LOOKING' : null
  const [sit, setSit] = useState<Record<string, string>>(details.situation)
  const hasDetails = j === 'TIME_OFF' || j === 'FRACTIONAL' || j === 'ENTREPRENEUR' || situationFieldsFor(j).length > 0
  const notASearch = !getJourney(j).searching && ACTIVE_SEARCH_STAGES.includes(s)
  const unchanged = j === journey && s === stage && (j !== 'EXPLORING_MOVE' || d === moveDriver) && i === initialI && !hasDetails

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
        <SubmitButton size="sm" variant="outline" disabled={unchanged || notASearch} title={unchanged ? 'Change one of these to save' : notASearch ? 'Choose a search situation or Managing your career first' : undefined}>
          Save situation
        </SubmitButton>
      </div>
      <div className="rounded-md bg-muted/40 p-3 text-sm" aria-live="polite">
        <p>
          <span className="font-medium">Your goal: </span>
          {getJourney(j).goal}
        </p>
        <p className="mt-1 text-muted-foreground">
          {getStage(s).plan}{' '}
          {getJourney(j).confidentialByDefault
            ? 'Most people in this situation keep Confidential Search Mode on.'
            : 'Your activity can be visible to your colleges and coach where you have shared it.'}{' '}
          {(j !== journey || s !== stage) && 'Saving changes your weekly plan, menu and emails right away.'}
        </p>
        {notASearch && (
          <p role="alert" className="mt-1 text-destructive">
            {getJourney(j).label} isn&apos;t a job search. To start applying, choose &ldquo;Thinking about a move&rdquo;, or pick &ldquo;Managing your career&rdquo; as where you are.
          </p>
        )}
      </div>
      {j === 'ENTREPRENEUR' && (
        <div className="space-y-1.5">
          <Label htmlFor="venture">What are you building, and where does it stand?</Label>
          <Input id="venture" name="venture" maxLength={300} defaultValue={details.venture} />
        </div>
      )}
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
      {j === 'TIME_OFF' && (
        <div className="space-y-1.5">
          <Label htmlFor="returnDate">When do you expect to be back?</Label>
          <Input id="returnDate" name="returnDate" type="date" defaultValue={details.returnDate} />
        </div>
      )}
      {j === 'FRACTIONAL' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="offering">Your one-line offer: who you help and the result</Label>
            <Input id="offering" name="offering" maxLength={200} defaultValue={details.offering} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openDays">Days a week open for new work</Label>
            <Input id="openDays" name="openDays" type="number" min={0} max={5} defaultValue={details.openDays} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="engagementEnds">Current engagement ends</Label>
            <Input id="engagementEnds" name="engagementEnds" type="date" defaultValue={details.engagementEnds} />
          </div>
        </div>
      )}
      {situationFieldsFor(j).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {situationFieldsFor(j).map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`sit-${f.key}`}>{f.label}</Label>
              {f.kind === 'choice' ? (
                <ChoiceButtons name={f.key} options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))} value={sit[f.key] ?? null} onChange={(v) => setSit((cur) => ({ ...cur, [f.key]: v }))} columns={3} responsive />
              ) : (
                <Input id={`sit-${f.key}`} name={f.key} type={f.kind === 'date' ? 'date' : f.kind === 'text' ? 'text' : 'number'} min={f.min} max={f.max} maxLength={f.kind === 'text' ? 120 : undefined} defaultValue={details.situation[f.key] ?? ''} />
              )}
            </div>
          ))}
        </div>
      )}
      {getJourney(j).searching && s !== 'STAYING' && s !== 'LANDED' && (
        <div className="space-y-1.5">
          <Label>How actively are you looking?</Label>
          <ChoiceButtons
            name="searchIntensity"
            options={INTENSITY_OPTIONS.map((x) => ({ value: x.key, label: `${x.label}: ${x.hint}` }))}
            value={i as (typeof INTENSITY_OPTIONS)[number]['key'] | null}
            onChange={setI}
            columns={2}
            responsive
          />
        </div>
      )}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.message && !state.error && <p role="status" className="text-sm text-brand">{state.message}</p>}
    </form>
  )
}
