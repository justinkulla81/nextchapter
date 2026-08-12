'use client'

import { useActionState, useState } from 'react'
import { confirmWorkAuthorization } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmHint } from '@/components/dashboard/ConfirmHint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { cn } from '@/lib/utils'

const WORK_AUTHORIZATION_OPTIONS = [
  { value: 'us_citizen', label: 'U.S. citizen' },
  { value: 'permanent_resident', label: 'Green card / permanent resident' },
  { value: 'work_authorized_no_sponsorship', label: "Authorized to work, don't need sponsorship" },
  { value: 'need_sponsorship', label: 'Will need visa sponsorship' },
  { value: 'other', label: 'Other' },
] as const

const VISA_STATUS_OPTIONS = [
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'h1b', label: 'H-1B' },
  { value: 'opt', label: 'OPT / STEM OPT' },
  { value: 'tn', label: 'TN' },
  { value: 'other', label: 'Other visa' },
] as const

const WORK_AUTHORIZATION_LABELS: Record<string, string> = Object.fromEntries(
  WORK_AUTHORIZATION_OPTIONS.map((opt) => [opt.value, opt.label])
)

const VISA_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  VISA_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
)

const POINTS = estimateActionEffort({ actionType: 'WORK_AUTHORIZATION' }).points

export function WorkAuthorizationConfirmForm({
  workAuthorization,
  visaStatus,
  confirmedAt,
}: {
  workAuthorization: string | null
  visaStatus: string | null
  confirmedAt: Date | null
}) {
  const [state, formAction, pending] = useActionState(confirmWorkAuthorization, undefined)

  // Base UI's Select silently highlights the first item as its uncontrolled
  // default when no value is given at all — it doesn't stay in a genuine
  // "nothing chosen" state the way the placeholder text implied. Left
  // implicit, that meant every never-answered candidate silently defaulted
  // to "U.S. citizen," a presumptuous guess for a platform with
  // international candidates. These intentional, broadly-safe defaults
  // replace that accident — most candidates here don't need sponsorship.
  const initialWorkAuthorization = workAuthorization ?? 'work_authorized_no_sponsorship'
  const initialVisaStatus = visaStatus ?? 'not_applicable'

  const [workAuth, setWorkAuth] = useState(initialWorkAuthorization)
  const [visa, setVisa] = useState(initialVisaStatus)

  const isConfirmed = !!confirmedAt
  const isDirty = workAuth !== initialWorkAuthorization || visa !== initialVisaStatus
  const canConfirm = !isConfirmed || isDirty

  return (
    <form action={formAction} className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <ConfirmHint show={!isConfirmed} />
      <Select
        name="workAuthorization"
        value={workAuth}
        onValueChange={(v) => setWorkAuth((v as string) ?? initialWorkAuthorization)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Work authorization">
            {(value: string | null) => (value ? WORK_AUTHORIZATION_LABELS[value] : 'Work authorization')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WORK_AUTHORIZATION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select name="visaStatus" value={visa} onValueChange={(v) => setVisa((v as string) ?? initialVisaStatus)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Visa status (if applicable)">
            {(value: string | null) => (value ? VISA_STATUS_LABELS[value] : 'Visa status (if applicable)')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VISA_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={canConfirm ? 'success' : 'ghost'} disabled={pending || !canConfirm}>
          {pending ? 'Saving…' : canConfirm ? 'Save' : 'Saved'}
        </Button>
        {!isConfirmed && <span className="text-xs font-medium text-muted-foreground tabular-nums">+{POINTS} pts</span>}
      </div>
    </form>
  )
}
