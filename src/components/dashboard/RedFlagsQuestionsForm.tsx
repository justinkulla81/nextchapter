'use client'

import { useActionState, useState } from 'react'
import { answerRedFlags, type RedFlagsState } from '@/app/dashboard/complete-profile/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

export function RedFlagsQuestionsForm() {
  const [state, formAction, pending] = useActionState<RedFlagsState, FormData>(answerRedFlags, undefined)
  const [drugTest, setDrugTest] = useState('')
  const [backgroundCheck, setBackgroundCheck] = useState('')
  const [restrictiveCovenant, setRestrictiveCovenant] = useState('')
  const [animalFriendly, setAnimalFriendly] = useState('')

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2">
        <Label>Are you willing to take a drug test if an employer requires one?</Label>
        <ChoiceButtons
          name="willingToTakeDrugTest"
          options={YES_NO_OPTIONS}
          value={drugTest || null}
          onChange={setDrugTest}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Are you willing to undergo a background check if an employer requires one?</Label>
        <ChoiceButtons
          name="willingToTakeBackgroundCheck"
          options={YES_NO_OPTIONS}
          value={backgroundCheck || null}
          onChange={setBackgroundCheck}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>
          Do you have a non-compete, non-solicit, or other restrictive covenant that could affect your next role?
        </Label>
        <ChoiceButtons
          name="hasRestrictiveCovenant"
          options={YES_NO_OPTIONS}
          value={restrictiveCovenant || null}
          onChange={setRestrictiveCovenant}
          columns={2}
        />
        {restrictiveCovenant === 'yes' && (
          <Textarea name="restrictiveCovenantDetails" placeholder="What kind, and for how long?" />
        )}
      </div>

      <div className="space-y-2">
        <Label>Do you want to work somewhere that&apos;s animal/pet-friendly?</Label>
        <ChoiceButtons
          name="wantsAnimalFriendlyWorkplace"
          options={YES_NO_OPTIONS}
          value={animalFriendly || null}
          onChange={setAnimalFriendly}
          columns={2}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save answers'}
      </Button>
    </form>
  )
}
