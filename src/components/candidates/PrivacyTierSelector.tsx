'use client'

import { useActionState, useState } from 'react'
import { updatePrivacyTier } from '@/app/dashboard/privacy/actions'
import { PRIVACY_TIERS } from '@/lib/constants/privacy'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { posthog } from '@/lib/posthog/client'
import { communityAccessLine } from '@/lib/redesign/network-account'
import { cn } from '@/lib/utils'
import type { PrivacyTier } from '@prisma/client'

export function PrivacyTierSelector({
  currentTier,
  alreadyAwarded = true,
}: {
  currentTier: PrivacyTier
  alreadyAwarded?: boolean
}) {
  const [state, formAction, pending] = useActionState(updatePrivacyTier, undefined)
  const [selected, setSelected] = useState<PrivacyTier>(currentTier)
  const selectedTier = PRIVACY_TIERS.find((tier) => tier.value === selected)!

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
