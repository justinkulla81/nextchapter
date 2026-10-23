'use client'

import { useActionState, useState } from 'react'
import { savePackageWishes } from '@/app/dashboard/pay/actions'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import {
  PACKAGE_BENEFIT_OPTIONS,
  PACKAGE_NUMBER_FIELDS,
  type PackageBenefitKey,
  type PackageNumberKey,
} from '@/lib/review-prep/package-wishes'

// Pay page: tick the benefits you want, add numbers if you have them. All
// optional; unticked means not wanted. What is saved becomes the "what to ask
// for" list in the conversation you build on this page.
export function PackageWishesForm({
  initialBenefits,
  initialNumbers,
}: {
  initialBenefits: PackageBenefitKey[]
  initialNumbers: Record<PackageNumberKey, number | null>
}) {
  const [state, formAction, pending] = useActionState(savePackageWishes, undefined)
  const [benefits, setBenefits] = useState<PackageBenefitKey[]>(initialBenefits)

  return (
    <form action={formAction} className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2">
        <Label>Which of these do you want? Tick any that matter.</Label>
        <MultiChoiceButtons name="benefits" options={PACKAGE_BENEFIT_OPTIONS} value={benefits} onChange={setBenefits} columns={2} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Numbers, if you have them <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {PACKAGE_NUMBER_FIELDS.map((field) => (
            <div key={field.name} className="space-y-1">
              <Label htmlFor={field.name} className="text-sm font-normal text-muted-foreground">
                {field.label}
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                min={0}
                max={field.max}
                defaultValue={initialNumbers[field.name] ?? undefined}
                className="w-28"
              />
            </div>
          ))}
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.saved && !state.error && (
        <p role="status" className="text-sm text-success">
          Saved. These now appear in what you ask for.
        </p>
      )}
      <SubmitButton pendingLabel="Saving…">Save what I want</SubmitButton>
    </form>
  )
}
