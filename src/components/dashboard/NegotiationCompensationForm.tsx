'use client'

import { useActionState, useState } from 'react'
import type { CandidateProfile } from '@prisma/client'
import { updateNegotiationAndCompensationReadiness } from '@/app/dashboard/search-strategy/actions'
import { useAdvanceSearchStrategyPageOnSave } from '@/components/dashboard/SearchStrategyWizard'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

const STOPS = [
  { value: 25, label: 'Not really' },
  { value: 50, label: 'Somewhat' },
  { value: 75, label: 'Mostly' },
  { value: 100, label: 'Completely' },
] as const

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
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

// Negotiation & Interview Comfort and Compensation & Benefits share one
// wizard page — one form, one save action, one Save button. See
// MarketingNetworkingForm's own comment for why combining the save doesn't
// change either question set's own semantics.
export function NegotiationCompensationForm({
  profile,
  targetCompMin,
}: {
  profile: CandidateProfile
  targetCompMin: number | null
}) {
  const [state, formAction, pending] = useActionState(updateNegotiationAndCompensationReadiness, undefined)
  useAdvanceSearchStrategyPageOnSave(pending, !!state?.error)

  const [negotiationComfort, setNegotiationComfort] = useState<number | null>(profile.negotiationComfort)
  const [interviewComfort, setInterviewComfort] = useState<number | null>(profile.interviewComfort)
  const [healthDentalVision, setHealthDentalVision] = useState('')
  const [disability, setDisability] = useState('')
  const [k401, set401k] = useState('')
  const [profDev, setProfDev] = useState('')
  const [commuter, setCommuter] = useState('')
  const [gym, setGym] = useState('')

  return (
    <form action={formAction} className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-foreground">Negotiation &amp; Interview Comfort</h3>

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
      </div>

      <div className="space-y-6 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Compensation &amp; Benefits</h3>

        <div className="space-y-2">
          <Label>Do you want Health/Dental/Vision insurance?</Label>
          <ChoiceButtons
            name="wantsHealthDentalVisionInsurance"
            options={YES_NO_OPTIONS}
            value={healthDentalVision || null}
            onChange={setHealthDentalVision}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Do you want a 401k/retirement plan?</Label>
          <ChoiceButtons
            name="wants401kMatch"
            options={YES_NO_OPTIONS}
            value={k401 || null}
            onChange={set401k}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ptoWeeksExpected">
            How many weeks of PTO do you expect? <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="ptoWeeksExpected" name="ptoWeeksExpected" type="number" min={0} max={20} className="w-32" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="remoteDaysPerWeekDesired">
            How many days per week would you like to work from home?{' '}
            <span className="font-normal text-muted-foreground">(optional, 0–5)</span>
          </Label>
          <Input
            id="remoteDaysPerWeekDesired"
            name="remoteDaysPerWeekDesired"
            type="number"
            min={0}
            max={5}
            className="w-32"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetCompMin">What is the minimum comp you are able to take? (optional)</Label>
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

        <div className="space-y-2">
          <Label htmlFor="paidParentalLeaveWeeksExpected">
            How many weeks of paid parental leave do you expect?{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="paidParentalLeaveWeeksExpected"
            name="paidParentalLeaveWeeksExpected"
            type="number"
            min={0}
            max={52}
            className="w-32"
          />
        </div>

        <div className="space-y-2">
          <Label>Do you want disability insurance?</Label>
          <ChoiceButtons
            name="wantsDisabilityInsurance"
            options={YES_NO_OPTIONS}
            value={disability || null}
            onChange={setDisability}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Do you want professional development reimbursement?</Label>
          <ChoiceButtons
            name="wantsProfessionalDevReimbursement"
            options={YES_NO_OPTIONS}
            value={profDev || null}
            onChange={setProfDev}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Do you want commuter benefits?</Label>
          <ChoiceButtons
            name="wantsCommuterBenefits"
            options={YES_NO_OPTIONS}
            value={commuter || null}
            onChange={setCommuter}
            columns={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Do you want a gym membership?</Label>
          <ChoiceButtons
            name="wantsGymMembership"
            options={YES_NO_OPTIONS}
            value={gym || null}
            onChange={setGym}
            columns={2}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  )
}
