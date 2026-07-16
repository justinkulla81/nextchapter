'use client'

import { useActionState } from 'react'
import { createRecruiter } from '@/app/recruiters/signup/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function RecruiterSignupForm({ appUrl }: { appUrl: string }) {
  const [state, formAction, pending] = useActionState(createRecruiter, undefined)

  if (state?.accessToken) {
    const calibrateUrl = `${appUrl}/recruiters/calibrate/${state.accessToken}`
    return (
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="font-medium text-foreground">You&apos;re set up.</p>
        <p className="text-sm text-muted-foreground">
          Bookmark this link — there&apos;s no password, so it&apos;s your only way back in:
        </p>
        <p className="text-sm">
          <a href={calibrateUrl} className="text-primary underline underline-offset-4">
            {calibrateUrl}
          </a>
        </p>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="recruiter-name">Full name</Label>
        <Input id="recruiter-name" name="fullName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-email">Work email</Label>
        <Input id="recruiter-email" name="workEmail" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-firm">Firm name (optional)</Label>
        <Input id="recruiter-firm" name="firmName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-specialty">What do you recruit for? (optional)</Label>
        <Input id="recruiter-specialty" name="specialty" placeholder="e.g. VP Finance, Operations Director" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Setting up…' : 'Get my calibration tool link'}
      </Button>
    </form>
  )
}
