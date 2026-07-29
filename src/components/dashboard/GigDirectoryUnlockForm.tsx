'use client'

import { useActionState } from 'react'
import { submitGigDirectoryUnlock } from '@/app/dashboard/interim-work/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function GigDirectoryUnlockForm() {
  const [state, formAction, pending] = useActionState(submitGigDirectoryUnlock, undefined)

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Interim and fractional work fills an employment gap while you search — a gap you can
          explain in your own words is a controllable lever, unlike a gap that just sits there
          unexplained.
        </p>
        <p>
          Set expectations before you browse: fractional/interim rates typically land well below a
          full-time equivalent salary once you annualize the hours, and consulting-marketplace work
          is inconsistent — treat it as a bridge, not a replacement income.
        </p>
      </div>
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="answer">
            What&apos;s your target rate or day-rate range for interim work, so this feels realistic?
          </Label>
          <Textarea id="answer" name="answer" required rows={2} />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
          {pending ? 'Saving…' : 'See the directory'}
        </Button>
      </form>
    </div>
  )
}
