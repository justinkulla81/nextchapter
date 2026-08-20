'use client'

import { useActionState } from 'react'
import { createAdminStoryAction } from '@/app/support/admin/(portal)/community-stories/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

// Posts directly into the candidate-facing Community feed (dashboard/community),
// under the "NextChapter Team" system account — published immediately, no
// moderation queue, since this is trusted admin-authored content, not a
// candidate submission. See createAdminStoryPost for the write path.
export function AdminStoryForm() {
  const [state, formAction] = useActionState(createAdminStoryAction, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Post a story to the Community feed</p>
      <div className="space-y-1">
        <label htmlFor="story-title" className="text-xs font-medium text-muted-foreground">
          Title (optional)
        </label>
        <Input id="story-title" name="title" placeholder="e.g. Meet this week's Offer Bonus winner" />
      </div>
      <div className="space-y-1">
        <label htmlFor="story-description" className="text-xs font-medium text-muted-foreground">
          Story
        </label>
        <Textarea id="story-description" name="description" rows={4} required />
      </div>
      <div className="space-y-1">
        <label htmlFor="story-externalUrl" className="text-xs font-medium text-muted-foreground">
          Link (optional)
        </label>
        <Input id="story-externalUrl" name="externalUrl" placeholder="https://…" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Posting…">Post to Community</SubmitButton>
    </form>
  )
}
