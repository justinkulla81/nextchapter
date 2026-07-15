'use client'

import { useActionState } from 'react'
import { createCoach } from '@/app/support/coach/signup/actions'
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
import { cn } from '@/lib/utils'

const FOCUS_OPTIONS = [
  { value: 'CAREER', label: 'Career' },
  { value: 'LIFE', label: 'Life' },
  { value: 'EXECUTIVE', label: 'Executive' },
  { value: 'EOS', label: 'EOS' },
  { value: 'OTHER', label: 'Other' },
]

export function CoachSignupForm({ appUrl }: { appUrl: string }) {
  const [state, formAction, pending] = useActionState(createCoach, undefined)

  if (state?.accessToken) {
    const inviteUrl = `${appUrl}/support/coach/invite/${state.accessToken}`
    const clientsUrl = `${appUrl}/support/coach/clients/${state.accessToken}`
    return (
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="font-medium text-foreground">You&apos;re set up.</p>
        <p className="text-sm text-muted-foreground">
          Bookmark these two links — there&apos;s no password, so they&apos;re your only way back
          in:
        </p>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-foreground">Your invite link: </span>
            <a href={inviteUrl} className="text-primary underline underline-offset-4">
              {inviteUrl}
            </a>
          </p>
          <p>
            <span className="font-medium text-foreground">Your client list: </span>
            <a href={clientsUrl} className="text-primary underline underline-offset-4">
              {clientsUrl}
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="coach-name">Full name</Label>
        <Input id="coach-name" name="fullName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="coach-email">Work email</Label>
        <Input id="coach-email" name="workEmail" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="coach-firm">Practice / firm name (optional)</Label>
        <Input id="coach-firm" name="firmName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="coach-focus">Coaching focus</Label>
        <Select name="focus" defaultValue="CAREER">
          <SelectTrigger id="coach-focus" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                FOCUS_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FOCUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Setting up…' : 'Get my invite link'}
      </Button>
    </form>
  )
}
