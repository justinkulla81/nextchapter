'use client'

import { useActionState, useState } from 'react'
import { updateNotificationTier } from '@/app/dashboard/privacy/actions'
import { NOTIFICATION_TIERS } from '@/lib/constants/notifications'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { cn } from '@/lib/utils'
import type { NotificationTier } from '@prisma/client'

export function NotificationTierSelector({ currentTier }: { currentTier: NotificationTier }) {
  const [state, formAction, pending] = useActionState(updateNotificationTier, undefined)
  const [selected, setSelected] = useState<NotificationTier>(currentTier)
  const selectedTier = NOTIFICATION_TIERS.find((t) => t.value === selected)!

  // The redesign: three choices side by side, the selected one explained in a sentence. The "Recommended" and
  // "Currently set" tags are now words in that sentence.
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
