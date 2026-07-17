'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/support/admin/exclusive-jobs/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function ExclusiveJobPostingForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" name="location" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">Real posting URL</Label>
          <Input id="url" name="url" type="url" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Note for candidates (optional)</Label>
        <Input id="description" name="description" placeholder="Why this one's worth a look" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Adding…">Add exclusive posting</SubmitButton>
    </form>
  )
}
