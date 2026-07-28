'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/support/admin/(portal)/layoff-cohorts/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function LayoffCohortForm({
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
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" name="companyName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="layoffDate">Layoff date</Label>
          <Input id="layoffDate" name="layoffDate" type="date" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estimatedSize">Estimated size (optional)</Label>
          <Input id="estimatedSize" name="estimatedSize" type="number" min={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newsUrl">News link (optional)</Label>
          <Input id="newsUrl" name="newsUrl" type="url" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Creating…">Create cohort</SubmitButton>
    </form>
  )
}
