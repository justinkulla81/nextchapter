'use client'

import { useActionState, useState } from 'react'
import { updatePrivacyTier } from '@/app/dashboard/privacy/actions'
import { PRIVACY_TIERS } from '@/lib/constants/privacy'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PrivacyTier } from '@prisma/client'

export function PrivacyTierSelector({ currentTier }: { currentTier: PrivacyTier }) {
  const [state, formAction, pending] = useActionState(updatePrivacyTier, undefined)
  const [selected, setSelected] = useState<PrivacyTier>(currentTier)

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {PRIVACY_TIERS.map((tier) => {
          const isSelected = selected === tier.value
          return (
            <label
              key={tier.value}
              className={cn(
                'flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors',
                isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
              )}
            >
              <input
                type="radio"
                name="privacyTier"
                value={tier.value}
                checked={isSelected}
                onChange={() => setSelected(tier.value)}
                className="sr-only"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  {tier.label}
                  {tier.recommended && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      Recommended
                    </span>
                  )}
                </span>
                {currentTier === tier.value && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Currently set
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{tier.description}</p>
              <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                {tier.preview}
              </p>
            </label>
          )
        })}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || selected === currentTier}>
        {pending ? 'Saving…' : 'Save privacy setting'}
      </Button>
    </form>
  )
}
