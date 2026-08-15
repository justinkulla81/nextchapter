'use client'

import { useActionState } from 'react'
import type { RecruiterFirm } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/recruiter-settings/actions'
import { EXPORT_DESTINATIONS } from '@/lib/constants/recruiter-export-destinations'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const STATUSES: { value: RecruiterFirm['status']; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REMOVED', label: 'Removed' },
]

const EXPORT_LABELS: Record<(typeof EXPORT_DESTINATIONS)[number], string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  bullhorn: 'Bullhorn',
}

const FEE_ARRANGEMENT_TYPES: { value: NonNullable<RecruiterFirm['feeArrangementType']>; label: string }[] = [
  { value: 'PERCENTAGE_OF_COMP', label: '% of first-year comp' },
  { value: 'FLAT_FEE', label: 'Flat fee' },
  { value: 'RETAINER', label: 'Retainer' },
]

export function RecruiterFirmForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing?: RecruiterFirm
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      {!existing && (
        <div className="space-y-2">
          <Label htmlFor="name">Firm name</Label>
          <Input id="name" name="name" required placeholder="e.g. Meridian Search Partners" />
        </div>
      )}

      {existing && (
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <label
                key={s.value}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input type="radio" name="status" value={s.value} required defaultChecked={existing.status === s.value} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="seatCount">Seat count</Label>
          <Input id="seatCount" name="seatCount" type="number" min={1} defaultValue={existing?.seatCount ?? 1} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="feedbackSlaHours">Feedback SLA override (hours, optional)</Label>
          <Input
            id="feedbackSlaHours"
            name="feedbackSlaHours"
            type="number"
            min={0}
            defaultValue={existing?.feedbackSlaHours ?? ''}
            placeholder="Inherits the default"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessScope">Access scope (free text)</Label>
        <Input
          id="accessScope"
          name="accessScope"
          defaultValue={existing?.accessScope ?? ''}
          placeholder="e.g. Director+ only, tech function"
        />
      </div>

      <div className="space-y-2">
        <Label>Export destinations enabled</Label>
        <div className="flex flex-wrap gap-2">
          {EXPORT_DESTINATIONS.map((dest) => (
            <label
              key={dest}
              className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="checkbox"
                name={`export_${dest}`}
                defaultChecked={existing?.exportDestinationsEnabled.includes(dest) ?? false}
              />
              {EXPORT_LABELS[dest]}
            </label>
          ))}
        </div>
      </div>

      {existing && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <Label>Default fee arrangement</Label>
          <p className="text-xs text-muted-foreground">
            Snapshotted onto each placement when it&apos;s recorded — changing this later never rewrites an
            already-recorded placement&apos;s terms.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="feeArrangementType"
                value=""
                defaultChecked={!existing.feeArrangementType}
              />
              Not set
            </label>
            {FEE_ARRANGEMENT_TYPES.map((t) => (
              <label
                key={t.value}
                className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="feeArrangementType"
                  value={t.value}
                  defaultChecked={existing.feeArrangementType === t.value}
                />
                {t.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feeArrangementPercentage">Percentage (if applicable)</Label>
              <Input
                id="feeArrangementPercentage"
                name="feeArrangementPercentage"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={existing.feeArrangementPercentage ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeArrangementFlatAmountUsd">Flat amount, USD (if applicable)</Label>
              <Input
                id="feeArrangementFlatAmountUsd"
                name="feeArrangementFlatAmountUsd"
                type="number"
                min={0}
                defaultValue={existing.feeArrangementFlatAmountUsd ?? ''}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feeArrangementNotes">Fee arrangement notes</Label>
            <Textarea
              id="feeArrangementNotes"
              name="feeArrangementNotes"
              rows={2}
              defaultValue={existing.feeArrangementNotes ?? ''}
            />
          </div>
        </div>
      )}

      {existing && (
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={existing.notes ?? ''} />
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel={existing ? 'Saving…' : 'Adding…'}>{existing ? 'Save changes' : 'Add firm'}</SubmitButton>
    </form>
  )
}
