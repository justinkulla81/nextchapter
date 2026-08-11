'use client'

import { useActionState, useState } from 'react'
import { answerBenefitsPriorities, type BenefitsPrioritiesState } from '@/app/dashboard/complete-profile/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

export function BenefitsPrioritiesForm({ targetCompMin }: { targetCompMin: number | null }) {
  const [state, formAction, pending] = useActionState<BenefitsPrioritiesState, FormData>(
    answerBenefitsPriorities,
    undefined
  )
  const [healthDentalVision, setHealthDentalVision] = useState('')
  const [disability, setDisability] = useState('')
  const [k401, set401k] = useState('')
  const [profDev, setProfDev] = useState('')
  const [commuter, setCommuter] = useState('')
  const [gym, setGym] = useState('')

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
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
        <Label>Do you want a 401k/retirement plan?</Label>
        <ChoiceButtons name="wants401kMatch" options={YES_NO_OPTIONS} value={k401 || null} onChange={set401k} columns={2} />
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
        <ChoiceButtons name="wantsGymMembership" options={YES_NO_OPTIONS} value={gym || null} onChange={setGym} columns={2} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save answers'}
      </Button>
    </form>
  )
}
