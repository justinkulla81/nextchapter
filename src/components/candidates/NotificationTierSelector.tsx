'use client'

import { useActionState, useState } from 'react'
import { updateNotificationTier } from '@/app/dashboard/privacy/actions'
import { NOTIFICATION_TIERS } from '@/lib/constants/notifications'
import { Button } from '@/components/ui/button'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { cn } from '@/lib/utils'
import type { NotificationTier } from '@prisma/client'

export function NotificationTierSelector({ currentTier, redesign = false }: { currentTier: NotificationTier; redesign?: boolean }) {
  const [state, formAction, pending] = useActionState(updateNotificationTier, undefined)
  const [selected, setSelected] = useState<NotificationTier>(currentTier)
  const selectedTier = NOTIFICATION_TIERS.find((t) => t.value === selected)!

  // The redesign: three choices side by side, the selected one explained in a sentence. The "Recommended" and
  // "Currently set" tags are now words in that sentence.
  if (redesign) {
    const unchanged = selected === currentTier
    return (
      <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <input type="hidden" name="notificationTier" value={selected} />
        <ChoiceField
          name="notificationTierChoice"
          label="How many emails"
          options={NOTIFICATION_TIERS.map((t) => ({ value: t.value, label: t.label }))}
          value={selected}
          onChange={(v) => setSelected(v as NotificationTier)}
        />
        <p className="max-w-xl text-base text-ink">
          {selectedTier.description}
          {selectedTier.recommended && ' Most members keep this one, because it keeps the search moving.'}
        </p>
        {state?.error && (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || unchanged} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60">
            {pending ? 'Saving…' : 'Save notification setting'}
          </button>
          {unchanged && <span className="text-sm text-muted-foreground">This is your current setting. Choose a different one to change it.</span>}
        </div>
      </form>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {NOTIFICATION_TIERS.map((tier) => {
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
                name="notificationTier"
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
        {pending ? 'Saving…' : 'Save notification setting'}
      </Button>
    </form>
  )
}
