'use client'

import { useActionState } from 'react'
import { createWebinarAction } from '@/app/support/admin/(portal)/webinars/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

export function WebinarCreateForm() {
  const [state, formAction] = useActionState(createWebinarAction, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Schedule a webinar</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="title" className="text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="hostLabel" className="text-xs font-medium text-muted-foreground">
            Host (display name)
          </label>
          <Input id="hostLabel" name="hostLabel" placeholder="Coach Jane Smith / NextChapter Team" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="scheduledAt" className="text-xs font-medium text-muted-foreground">
            Date &amp; time
          </label>
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="durationMinutes" className="text-xs font-medium text-muted-foreground">
            Duration (minutes)
          </label>
          <Input id="durationMinutes" name="durationMinutes" type="number" defaultValue={45} min={15} />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Scheduling…">Schedule webinar</SubmitButton>
    </form>
  )
}
