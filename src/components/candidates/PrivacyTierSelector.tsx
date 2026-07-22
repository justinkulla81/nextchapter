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
  const selectedTier = PRIVACY_TIERS.find((tier) => tier.value === selected)!

  return (
    <form
      action={formAction}
      className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <input type="hidden" name="privacyTier" value={selected} />
      <div className="grid grid-cols-5 gap-2">
        {PRIVACY_TIERS.map((tier) => {
          const isSelected = selected === tier.value
          return (
            <button
              key={tier.value}
              type="button"
              onClick={() => setSelected(tier.value)}
              aria-pressed={isSelected}
              className={cn(
                'rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors',
                isSelected
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {tier.label}
            </button>
          )
        })}
      </div>

      {/* Only the selected tier's detail shows — five full descriptions at
          once was the confusing part, not the tier count itself. */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          {selectedTier.recommended && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Recommended
            </span>
          )}
          {currentTier === selectedTier.value && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Currently set
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{selectedTier.description}</p>
        <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          {selectedTier.preview}
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || selected === currentTier}>
        {pending ? 'Saving…' : 'Save privacy setting'}
      </Button>
    </form>
  )
}
