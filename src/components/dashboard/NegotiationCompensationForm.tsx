'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { updateNegotiationAndCompensationReadiness } from '@/app/dashboard/search-strategy/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { posthog } from '@/lib/posthog/client'
import {
  MissingNote,
  MissingSummary,
  scrollToQuestion,
  type MissingQuestion,
} from '@/components/dashboard/RequiredQuestions'
import { cn } from '@/lib/utils'

const STOPS = [
  { value: 25, label: 'Not really' },
  { value: 50, label: 'Somewhat' },
  { value: 75, label: 'Mostly' },
  { value: 100, label: 'Completely' },
] as const

function ComfortRow({
  id,
  name,
  label,
  value,
  onChange,
  showMissing,
}: {
  id: string
  name: string
  label: string
  value: number | null
  onChange: (v: number) => void
  showMissing: boolean
}) {
  return (
    <div id={id} className="scroll-mt-24 space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value ?? ''} />
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {STOPS.map((stop) => (
          <button
            key={stop.value}
            type="button"
            onClick={() => onChange(stop.value)}
            aria-pressed={value === stop.value}
            className={cn(
              'rounded-lg border-2 p-2 text-center text-[11px] leading-snug font-medium transition-colors sm:p-3 sm:text-sm',
              value === stop.value
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-border bg-white text-foreground hover:border-brand/40'
            )}
          >
            {stop.label}
          </button>
        ))}
      </div>
      <MissingNote show={showMissing && value === null} />
    </div>
  )
}

// Interviews, offers and pay: how comfortable the member is negotiating and
// interviewing (both needed), and the lowest pay they could take (optional).
// The benefits they want now live on the Pay page, where they are used.
export function NegotiationCompensationForm({
  candidateId,
  negotiationComfort: negotiationInitial,
  interviewComfort: interviewInitial,
  targetCompMin,
}: {
  candidateId: string
  negotiationComfort: number | null
  interviewComfort: number | null
  targetCompMin: number | null
}) {
  const [state, formAction, pending] = useActionState(updateNegotiationAndCompensationReadiness, undefined)
  useAdvanceSearchStrategyPageOnSave(pending, !!state?.error)

  const [negotiationComfort, setNegotiationComfort] = useState<number | null>(negotiationInitial)
  const [interviewComfort, setInterviewComfort] = useState<number | null>(interviewInitial)
  // Set once a save is blocked; the per-question notes then clear as each is answered.
  const [showMissing, setShowMissing] = useState(false)

  const missing: MissingQuestion[] = [
    ...(negotiationComfort === null
      ? [{ id: 'question-negotiation', label: 'How comfortable you are negotiating' }]
      : []),
    ...(interviewComfort === null ? [{ id: 'question-interviews', label: 'How comfortable you are in interviews' }] : []),
  ]

  // Stops the save before it is sent, so nothing already picked or typed is lost.
  function blockSaveIfIncomplete(event: FormEvent<HTMLFormElement>) {
    if (missing.length === 0) return
    event.preventDefault()
    setShowMissing(true)
    posthog.capture('search_strategy_negotiation_save_blocked', {
      candidateId,
      missing: missing.map((m) => m.id.replace('question-', '')),
      missingCount: missing.length,
    })
    scrollToQuestion(missing[0].id)
  }

  return (
    <form
      action={formAction}
      onSubmit={blockSaveIfIncomplete}
      className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className="text-sm text-muted-foreground">
        Both comfort questions are needed to save this page. Minimum pay is optional.
      </p>

      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-foreground">Interviews and offers</h3>
        <ComfortRow
          id="question-negotiation"
          name="negotiationComfort"
          label="How comfortable are you negotiating pay and terms once you get an offer?"
          value={negotiationComfort}
          onChange={setNegotiationComfort}
          showMissing={showMissing}
        />
        <ComfortRow
          id="question-interviews"
          name="interviewComfort"
          label="How comfortable are you in interviews?"
          value={interviewComfort}
          onChange={setInterviewComfort}
          showMissing={showMissing}
        />
        <p className="text-xs text-muted-foreground">
          A low score on either shapes the skills we suggest you build and which career-advice videos
          we surface first.
        </p>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Pay</h3>
        <div className="space-y-2">
          <Label htmlFor="targetCompMin">
            What is the lowest pay you could take? <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="targetCompMin"
                name="targetCompMinThousands"
                type="number"
                min={0}
                placeholder="120"
                className="pl-7"
                defaultValue={targetCompMin ? Math.round(targetCompMin / 1000) : undefined}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              ,000 — e.g. enter <span className="font-medium text-foreground">120</span> for $120,000
            </span>
          </div>
        </div>
      </div>

      <MissingSummary show={showMissing} missing={missing} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
