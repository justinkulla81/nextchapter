'use client'

import { useActionState } from 'react'
import type { RecruiterSettings } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/recruiter-settings/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const ENFORCEMENT_OPTIONS: { value: RecruiterSettings['feedbackSlaEnforcement']; label: string }[] = [
  { value: 'NONE', label: 'No enforcement' },
  { value: 'WARN', label: 'Warn the firm' },
  { value: 'SUSPEND', label: 'Suspend on repeated non-response' },
]

export function RecruiterSettingsForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing: RecruiterSettings
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-6 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="consentExpiryDays">Consent expiry window (days)</Label>
          <Input id="consentExpiryDays" name="consentExpiryDays" type="number" min={0} defaultValue={existing.consentExpiryDays} />
          <p className="text-xs text-muted-foreground">Applied to new consented introductions going forward.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rankingWeightDossierCompleteness">Dossier-completeness ranking weight</Label>
          <Input
            id="rankingWeightDossierCompleteness"
            name="rankingWeightDossierCompleteness"
            type="number"
            min={0}
            defaultValue={existing.rankingWeightDossierCompleteness}
          />
          <p className="text-xs text-muted-foreground">Stored now — the Recruiter portal ranking (Phase 6) will read it.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="feedbackSlaHoursDefault">Default feedback SLA (hours)</Label>
          <Input id="feedbackSlaHoursDefault" name="feedbackSlaHoursDefault" type="number" min={0} defaultValue={existing.feedbackSlaHoursDefault} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Feedback SLA enforcement</Label>
        <div className="flex flex-wrap gap-2">
          {ENFORCEMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="feedbackSlaEnforcement"
                value={opt.value}
                required
                defaultChecked={existing.feedbackSlaEnforcement === opt.value}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="max-w-64 space-y-2">
        <Label htmlFor="feedbackNonResponseSuspendThreshold">Consecutive SLA misses before suspension flag</Label>
        <Input
          id="feedbackNonResponseSuspendThreshold"
          name="feedbackNonResponseSuspendThreshold"
          type="number"
          min={1}
          defaultValue={existing.feedbackNonResponseSuspendThreshold}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save recruiter settings</SubmitButton>
    </form>
  )
}
