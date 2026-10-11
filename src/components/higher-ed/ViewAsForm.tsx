'use client'

import { useActionState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { startViewAs } from '@/app/i/[slug]/(portal)/actions'

// nc_admin on a real tenant (spec §2): every View-as writes an
// AdminAccessLog row with a reason, and lasts an hour.
export function ViewAsForm({ slug, institutionName }: { slug: string; institutionName: string }) {
  const [state, action] = useActionState(startViewAs.bind(null, slug), null)
  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">View {institutionName} as a NextChapter admin</p>
      <p className="text-sm text-muted-foreground">This is logged with your reason. It opens every workspace for one hour.</p>
      <div className="space-y-1.5">
        <Label htmlFor="view-as-reason">Reason</Label>
        <Textarea id="view-as-reason" name="reason" required rows={2} placeholder="e.g. Support ticket 1234: roster import errors" />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton pendingLabel="Opening…">Start View as</SubmitButton>
    </form>
  )
}
