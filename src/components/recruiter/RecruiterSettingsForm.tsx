'use client'

import { useActionState } from 'react'
import type { Recruiter } from '@prisma/client'
import { updateRecruiterSettings } from '@/app/recruiters/settings/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function RecruiterSettingsForm({ recruiter }: { recruiter: Recruiter }) {
  const [state, formAction, pending] = useActionState(updateRecruiterSettings, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={recruiter.fullName} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="firmName">Firm name</Label>
        <Input id="firmName" name="firmName" defaultValue={recruiter.firmName ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="specialty">What do you recruit for?</Label>
        <Input
          id="specialty"
          name="specialty"
          defaultValue={recruiter.specialty ?? ''}
          placeholder="e.g. VP Finance, Operations Director"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">Saved.</p>}

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  )
}
