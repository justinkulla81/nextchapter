'use client'

import { useActionState, useState } from 'react'
import { updatePrivacyTier } from '@/app/dashboard/privacy/actions'
import { PRIVACY_TIERS } from '@/lib/constants/privacy'
import { Button } from '@/components/ui/button'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { posthog } from '@/lib/posthog/client'
import { communityAccessLine } from '@/lib/redesign/network-account'
import { cn } from '@/lib/utils'
import type { PrivacyTier } from '@prisma/client'

export function PrivacyTierSelector({
  currentTier,
  alreadyAwarded = true,
  redesign = false,
}: {
  currentTier: PrivacyTier
  alreadyAwarded?: boolean
  /** The redesigned look: five tiers as a dropdown (five is too many for buttons), one sentence on what the tier does, no tags. */
  redesign?: boolean
}) {
  const [state, formAction, pending] = useActionState(updatePrivacyTier, undefined)
  const [selected, setSelected] = useState<PrivacyTier>(currentTier)
  const selectedTier = PRIVACY_TIERS.find((tier) => tier.value === selected)!

  if (redesign) {
    const unchanged = selected === currentTier
    return (
      <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <input type="hidden" name="privacyTier" value={selected} />
        <ChoiceField
          name="privacyTierChoice"
          label="Who can see your profile"
          why="This is the visibility employers and other members get. It is separate from Confidential Search Mode and from the recruiter database."
          options={PRIVACY_TIERS.map((t) => ({ value: t.value, label: t.label }))}
          value={selected}
          onChange={(v) => setSelected(v as PrivacyTier)}
        />
        <div className="max-w-xl space-y-2">
          <p className="text-base text-ink">
            {selectedTier.description}
            {selectedTier.recommended && ' Most members choose this, because it gets you found.'}
          </p>
          <p className="text-sm text-muted-foreground">What an employer sees: {selectedTier.preview}</p>
          <p className="text-sm text-muted-foreground">{communityAccessLine(selectedTier.value).text}</p>
        </div>

        {state?.error && (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || unchanged}
            onClick={() => posthog.capture('privacy_tier_saved', { from: currentTier, to: selected })}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save privacy setting'}
          </button>
          <span className="text-sm text-muted-foreground">
            {unchanged ? 'This is your current setting. Choose a different one to change it.' : !alreadyAwarded ? 'Confirming a setting here counts toward Candidate+ once.' : ''}
          </span>
        </div>
      </form>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <input type="hidden" name="privacyTier" value={selected} />
      <div className="grid grid-cols-5 gap-2">
        {PRIVACY_TIERS.map((tier) => {
          const isSelected = selected === tier.value
          const unlocksSupportNetwork = tier.value === 'PUBLIC' || tier.value === 'SEMI_PUBLIC'
          return (
            <button
              key={tier.value}
              type="button"
              onClick={() => setSelected(tier.value)}
              aria-pressed={isSelected}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors',
                isSelected
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              <span>{tier.label}</span>
              {unlocksSupportNetwork && (
                <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium normal-case text-success">
                  Unlocks Support Network
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Only the selected tier's detail shows — five full descriptions at
          once was the confusing part, not the tier count itself. */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
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
          {(selectedTier.value === 'PUBLIC' || selectedTier.value === 'SEMI_PUBLIC') && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Unlocks Support Network
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{selectedTier.description}</p>
        {(selectedTier.value === 'PUBLIC' || selectedTier.value === 'SEMI_PUBLIC') && (
          <p className="mt-1 text-sm text-muted-foreground">
            Posting, commenting, expressing interest, and sending encouragement in the Support
            Network all require Public or Semi-Public visibility.
          </p>
        )}
        <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          {selectedTier.preview}
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || selected === currentTier}>
          {pending ? 'Saving…' : 'Save privacy setting'}
        </Button>
        {!alreadyAwarded && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            +5 pts, one time, for confirming any setting here
          </span>
        )}
      </div>
    </form>
  )
}
