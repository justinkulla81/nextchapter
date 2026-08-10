'use client'

import { useActionState } from 'react'
import type { CandidateEmailSchedule, PrivacyTier } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/email-cadence/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const PRIVACY_TIERS: { value: PrivacyTier; label: string }[] = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'SEMI_PUBLIC', label: 'Semi-public' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'STEALTH', label: 'Stealth' },
  { value: 'LOCKED', label: 'Locked' },
]

export function EmailCadenceForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing: CandidateEmailSchedule
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={existing.title} placeholder="Display name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Admin note (never sent)</Label>
        <Input
          id="description"
          name="description"
          defaultValue={existing.description ?? ''}
          placeholder="What this email is for"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="introCopy">Intro copy (optional)</Label>
        <Textarea
          id="introCopy"
          name="introCopy"
          rows={3}
          defaultValue={existing.introCopy ?? ''}
          placeholder="Static framing text shown above this email's personalized content…"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sendHourUtc">Send hour (UTC)</Label>
          <Input
            id="sendHourUtc"
            name="sendHourUtc"
            type="number"
            min={0}
            max={23}
            required
            defaultValue={existing.sendHourUtc}
          />
          <p className="text-xs text-muted-foreground">
            Informational only right now — our Vercel plan only allows one dispatch run per day
            (around 13:00 UTC), so every email currently goes out around that time regardless of
            this value. Upgrading to Vercel Pro would restore per-email hour precision.
          </p>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={existing.isActive} />
            Active
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Eligible privacy tiers</Label>
        <p className="text-xs text-muted-foreground">Leave all unchecked to allow every tier — no restriction.</p>
        <div className="grid grid-cols-3 gap-2">
          {PRIVACY_TIERS.map((tier) => (
            <label key={tier.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`privacyTier_${tier.value}`}
                defaultChecked={existing.eligiblePrivacyTiers.includes(tier.value)}
              />
              {tier.label}
            </label>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  )
}
