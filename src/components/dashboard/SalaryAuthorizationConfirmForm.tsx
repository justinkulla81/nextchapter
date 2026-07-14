'use client'

import { useActionState } from 'react'
import { confirmSalaryAndAuthorization } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  { value: 'visa_sponsorship_needed', label: 'Visa — will need sponsorship' },
  { value: 'visa_no_sponsorship_needed', label: "Visa — don't need sponsorship" },
  { value: 'other', label: 'Other' },
] as const

export function SalaryAuthorizationConfirmForm({
  lastSalary,
  workAuthorization,
}: {
  lastSalary: number | null
  workAuthorization: string | null
}) {
  const [state, formAction, pending] = useActionState(confirmSalaryAndAuthorization, undefined)

  return (
    <form action={formAction} className="space-y-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          name="lastSalary"
          type="number"
          min={0}
          placeholder="Last salary"
          className="pl-7"
          defaultValue={lastSalary ?? undefined}
        />
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
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
    </form>
  )
}
