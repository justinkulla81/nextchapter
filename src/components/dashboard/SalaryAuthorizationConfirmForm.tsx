'use client'

import { useActionState } from 'react'
import { confirmSalaryAndAuthorization } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

export function SalaryAuthorizationConfirmForm({
  lastSalary,
  workAuthorization,
  visaStatus,
}: {
  lastSalary: number | null
  workAuthorization: string | null
  visaStatus: string | null
}) {
  const [state, formAction, pending] = useActionState(confirmSalaryAndAuthorization, undefined)

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="lastSalaryThousands">Last salary</Label>
        <div className="flex items-center gap-2">
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="lastSalaryThousands"
              name="lastSalaryThousands"
              type="number"
              min={0}
              placeholder="120"
              className="pl-7"
              defaultValue={lastSalary ? Math.round(lastSalary / 1000) : undefined}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            ,000 — e.g. enter <span className="font-medium text-foreground">120</span> for $120,000
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Never shared with a recruiter or shown publicly — used only to match jobs and calibrate
          level.
        </p>
      </div>

      <Select name="workAuthorization" defaultValue={workAuthorization ?? undefined}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Work authorization" />
        </SelectTrigger>
        <SelectContent>
          {WORK_AUTHORIZATION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select name="visaStatus" defaultValue={visaStatus ?? undefined}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Visa status (if applicable)" />
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
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
    </form>
  )
}
