'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile } from '@prisma/client'
import { updateNegotiationInterviewComfort } from '@/app/dashboard/search-strategy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const STOPS = [
  { value: 25, label: 'Not really' },
  { value: 50, label: 'Somewhat' },
  { value: 75, label: 'Mostly' },
  { value: 100, label: 'Completely' },
] as const

function ComfortRow({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
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
    </div>
  )
}

export function NegotiationInterviewComfortForm({ profile }: { profile: CandidateProfile }) {
  const [state, formAction, pending] = useActionState(updateNegotiationInterviewComfort, undefined)
  const [negotiationComfort, setNegotiationComfort] = useState<number | null>(profile.negotiationComfort)
  const [interviewComfort, setInterviewComfort] = useState<number | null>(profile.interviewComfort)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <ComfortRow
        name="negotiationComfort"
        label="How comfortable are you negotiating comp and terms once you get an offer?"
        value={negotiationComfort}
        onChange={setNegotiationComfort}
      />
      <ComfortRow
        name="interviewComfort"
        label="How comfortable are you in interviews?"
        value={interviewComfort}
        onChange={setInterviewComfort}
      />
      <p className="text-xs text-muted-foreground">
        A low score on either shapes the skills we suggest you build and which career-advice videos
        we surface first.
      </p>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save Negotiation &amp; Interview Comfort</SubmitButton>
    </form>
  )
}
